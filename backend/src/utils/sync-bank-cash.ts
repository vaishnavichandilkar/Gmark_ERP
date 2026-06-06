import { AccountType, MasterStatus } from '@prisma/client';

function arraysEqual(a: string[], b: string[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function syncBankCashAccounts(prisma: any, userId: number) {
  // 1. Find the "Bank & Cash" SubSubGroup
  const bankCashGroup = await prisma.subSubGroup.findFirst({
    where: {
      name: { equals: 'Bank & Cash', mode: 'insensitive' }
    }
  });

  if (!bankCashGroup) {
    return;
  }

  // 2. Fetch all current SubSubSubGroup records under "Bank & Cash" for this user
  const bankCashSubGroups = await prisma.subSubSubGroup.findMany({
    where: {
      sub_sub_group_id: bankCashGroup.id,
      userId: userId,
    }
  });

  // 3. Fetch all current AccountMaster records for this user that are under "Bank & Cash" group
  const bankCashAccounts = await prisma.accountMaster.findMany({
    where: {
      userId,
      groupName: { has: 'Bank & Cash' }
    }
  });

  const activeGroupNames = new Set<string>();
  const accountsToCreate = [];
  const groupsToCreate = [];
  const updateOperations = [];

  // A. Sync from Groups to Accounts
  for (const group of bankCashSubGroups) {
    const isGroupActive = group.status === MasterStatus.ACTIVE;
    const existingAccount = bankCashAccounts.find(
      (acc) => acc.accountName.toLowerCase() === group.name.toLowerCase()
    );

    if (isGroupActive) {
      activeGroupNames.add(group.name.toLowerCase());

      if (!existingAccount) {
        // Create shadow account
        accountsToCreate.push({
          accountName: group.name,
          groupName: ['Bank & Cash'],
          accountType: (group.name.toLowerCase().includes('cash') || group.name.toLowerCase().includes('hand')) 
            ? AccountType.Cash 
            : AccountType.Bank,
          userId: userId,
          status: MasterStatus.ACTIVE,
          panNo: 'ABCDE1234F',
          addressLine1: 'Default Address',
          pincode: '000000',
          state: 'Unknown',
          prefix: 'Mr',
          contactPersonName: 'Admin',
          mobileNo: '0000000000',
          customerOpeningBalance: group.opening_balance ? Number(group.opening_balance) : null,
          customerBalanceType: group.balance_type || null,
          supplierOpeningBalance: group.opening_balance ? Number(group.opening_balance) : null,
          supplierBalanceType: group.balance_type || null,
        });
      } else {
        // Ensure it is active and has correct groupName, type, and opening balance fields
        const targetType = (group.name.toLowerCase().includes('cash') || group.name.toLowerCase().includes('hand')) 
          ? AccountType.Cash 
          : AccountType.Bank;

        const needsUpdate = existingAccount.status !== MasterStatus.ACTIVE ||
                            !arraysEqual(existingAccount.groupName, ['Bank & Cash']) ||
                            existingAccount.accountType !== targetType ||
                            Number(existingAccount.customerOpeningBalance || 0) !== Number(group.opening_balance || 0) ||
                            existingAccount.customerBalanceType !== (group.balance_type || null) ||
                            Number(existingAccount.supplierOpeningBalance || 0) !== Number(group.opening_balance || 0) ||
                            existingAccount.supplierBalanceType !== (group.balance_type || null);

        if (needsUpdate) {
          updateOperations.push(
            prisma.accountMaster.update({
              where: { id: existingAccount.id },
              data: {
                status: MasterStatus.ACTIVE,
                groupName: ['Bank & Cash'],
                accountType: targetType,
                customerOpeningBalance: group.opening_balance ? Number(group.opening_balance) : null,
                customerBalanceType: group.balance_type || null,
                supplierOpeningBalance: group.opening_balance ? Number(group.opening_balance) : null,
                supplierBalanceType: group.balance_type || null,
              }
            })
          );
        }
      }
    } else {
      // Group is inactive, make account inactive
      if (existingAccount && existingAccount.status === MasterStatus.ACTIVE) {
        updateOperations.push(
          prisma.accountMaster.update({
            where: { id: existingAccount.id },
            data: { status: MasterStatus.INACTIVE }
          })
        );
      }
    }
  }

  // B. Sync from Accounts to Groups (Bidirectional Restoration)
  for (const acc of bankCashAccounts) {
    const isAccActive = acc.status === MasterStatus.ACTIVE;
    
    if (isAccActive) {
      const existingGroup = bankCashSubGroups.find(
        (g) => g.name.toLowerCase() === acc.accountName.toLowerCase()
      );

      if (!existingGroup) {
        // Restore/Create the SubSubSubGroup under "Bank & Cash"
        groupsToCreate.push({
          name: acc.accountName,
          sub_sub_group_id: bankCashGroup.id,
          userId: userId,
          status: MasterStatus.ACTIVE
        });
        activeGroupNames.add(acc.accountName.toLowerCase());
      } else if (existingGroup.status === MasterStatus.INACTIVE) {
        // Reactivate the group if the account is active
        updateOperations.push(
          prisma.subSubSubGroup.update({
            where: { id: existingGroup.id },
            data: { status: MasterStatus.ACTIVE }
          })
        );
        activeGroupNames.add(acc.accountName.toLowerCase());
      } else {
        activeGroupNames.add(acc.accountName.toLowerCase());
      }
    }
  }

  // C. Inactivate shadow accounts that no longer have a corresponding active group
  for (const acc of bankCashAccounts) {
    if (!activeGroupNames.has(acc.accountName.toLowerCase())) {
      if (acc.status === MasterStatus.ACTIVE) {
        updateOperations.push(
          prisma.accountMaster.update({
            where: { id: acc.id },
            data: { status: MasterStatus.INACTIVE }
          })
        );
      }
    }
  }

  // D. Batch execute all accumulated writes
  if (accountsToCreate.length > 0) {
    await prisma.accountMaster.createMany({
      data: accountsToCreate
    });
  }

  if (groupsToCreate.length > 0) {
    await prisma.subSubSubGroup.createMany({
      data: groupsToCreate
    });
  }

  if (updateOperations.length > 0) {
    await prisma.$transaction(updateOperations);
  }
}


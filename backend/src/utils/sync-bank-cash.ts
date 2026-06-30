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
  // Cleanup any invalid shadow/subsubsubgroups that might have been created
  await prisma.subSubSubGroup.deleteMany({
    where: {
      userId,
      name: { in: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] }
    }
  });

  await prisma.accountMaster.deleteMany({
    where: {
      userId,
      accountName: { in: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] }
    }
  });

  // 1. Find the "Bank & Cash" SubSubGroup
  const bankCashGroup = await prisma.subSubGroup.findFirst({
    where: { name: { equals: 'Bank & Cash', mode: 'insensitive' } }
  });

  if (!bankCashGroup) return;

  // 2. Get all active SubSubSubGroups under "Bank & Cash"
  const bankCashSubGroups = await prisma.subSubSubGroup.findMany({
    where: { 
      sub_sub_group_id: bankCashGroup.id, 
      userId,
      name: { notIn: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] }
    }
  });

  // 3. Get all existing shadow AccountMaster records
  const bankCashAccounts = await prisma.accountMaster.findMany({
    where: {
      userId,
      accountName: { notIn: ['Bank & Cash', 'Bank and Cash', 'Cash in hand', 'Cash-in-hand'] },
      OR: [
        { groupName: { has: 'Bank & Cash' } },
        { accountType: { in: [AccountType.Bank, AccountType.Cash] } }
      ]
    }
  });

  const activeGroupNames = new Set<string>();
  const accountsToCreate = [];
  const groupsToCreate = [];
  const updateOperations = [];

  // A. Sync from Groups to Accounts
  for (const group of bankCashSubGroups) {
    if (group.status === MasterStatus.ACTIVE) {
      activeGroupNames.add(group.name.toLowerCase());
      
      const existingAccount = bankCashAccounts.find(
        (acc: any) => acc.accountName.toLowerCase() === group.name.toLowerCase()
      );

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
      const existingAccount = bankCashAccounts.find(
        (acc: any) => acc.accountName.toLowerCase() === group.name.toLowerCase()
      );
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

  // B. Sync from Accounts to Groups
  for (const acc of bankCashAccounts) {
    if (acc.status === MasterStatus.ACTIVE) {
      const existingGroup = bankCashSubGroups.find(
        (g: any) => g.name.toLowerCase() === acc.accountName.toLowerCase()
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

  // C. Deactivate accounts if their corresponding group is deleted/not active
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


import { AccountType, MasterStatus } from '@prisma/client';

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
        await prisma.accountMaster.create({
          data: {
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
            mobileNo: '0000000000'
          }
        });
      } else {
        // Ensure it is active and has correct groupName and type
        await prisma.accountMaster.update({
          where: { id: existingAccount.id },
          data: {
            status: MasterStatus.ACTIVE,
            groupName: ['Bank & Cash'],
            accountType: (group.name.toLowerCase().includes('cash') || group.name.toLowerCase().includes('hand')) 
              ? AccountType.Cash 
              : AccountType.Bank
          }
        });
      }
    } else {
      // Group is inactive, make account inactive
      if (existingAccount && existingAccount.status === MasterStatus.ACTIVE) {
        await prisma.accountMaster.update({
          where: { id: existingAccount.id },
          data: { status: MasterStatus.INACTIVE }
        });
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
        await prisma.subSubSubGroup.create({
          data: {
            name: acc.accountName,
            sub_sub_group_id: bankCashGroup.id,
            userId: userId,
            status: MasterStatus.ACTIVE
          }
        });
        activeGroupNames.add(acc.accountName.toLowerCase());
      } else if (existingGroup.status === MasterStatus.INACTIVE) {
        // Reactivate the group if the account is active
        await prisma.subSubSubGroup.update({
          where: { id: existingGroup.id },
          data: { status: MasterStatus.ACTIVE }
        });
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
        await prisma.accountMaster.update({
          where: { id: acc.id },
          data: { status: MasterStatus.INACTIVE }
        });
      }
    }
  }
}

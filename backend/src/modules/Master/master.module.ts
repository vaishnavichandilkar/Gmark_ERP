import { Module } from '@nestjs/common';
import { GroupMasterModule } from './group-master/group-master.module';
import { AccountMasterModule } from './account-master/account-master.module';
import { ProductMasterModule } from './product-master/product-master.module';
import { UnitMasterModule } from './unit-master/unit-master.module';
import { CategoryMasterModule } from './category-master/category-master.module';
import { HsnMasterModule } from './hsn-master/hsn-master.module';
import { EmployeeMasterModule } from './employee-master/employee-master.module';
import { DepartmentMasterModule } from './department-master/department-master.module';
import { CostCentreMasterModule } from './cost-centre-master/cost-centre-master.module';

@Module({
  imports: [
    GroupMasterModule,
    AccountMasterModule,
    ProductMasterModule,
    UnitMasterModule,
    CategoryMasterModule,
    HsnMasterModule,
    EmployeeMasterModule,
    DepartmentMasterModule,
    CostCentreMasterModule,
  ],
})
export class MasterModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SuperAdminService } from './src/modules/superadmin/superadmin.service';
import { PrismaService } from './src/infrastructure/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(SuperAdminService);
  const prisma = app.get(PrismaService);

  // Find a seller to test with (can be pending, approved or rejected)
  const seller = await prisma.user.findFirst({
    where: { role: 'seller' }
  });

  if (!seller) {
    console.error("No seller found in the database to test with.");
    await app.close();
    return;
  }

  console.log(`Found seller ID: ${seller.id}`);

  // Test Case 1: Valid payload
  const validPayload = JSON.stringify({
    generalRemark: "Please fix this details",
    rejectedFields: [
      {
        field: "firstName",
        fieldName: "First Name",
        reason: "First name does not match the submitted identity proof."
      }
    ]
  });

  console.log("\nTesting valid payload...");
  try {
    const res = await service.rejectSeller(seller.id, validPayload);
    console.log("Success:", res);
  } catch (err) {
    console.error("Failed unexpectedly:", err.message);
  }

  // Test Case 2: Invalid JSON format
  const invalidJson = "{invalid_json";
  console.log("\nTesting invalid JSON format...");
  try {
    await service.rejectSeller(seller.id, invalidJson);
    console.log("Failed: Rejection reason validated but should have failed.");
  } catch (err) {
    console.log("Passed! Expected error received:", err.message);
  }

  // Test Case 3: Invalid field key
  const invalidFieldKey = JSON.stringify({
    generalRemark: "Please fix",
    rejectedFields: [
      {
        field: "invalidFieldNameHere",
        fieldName: "Invalid Field",
        reason: "Some reason"
      }
    ]
  });
  console.log("\nTesting invalid field key...");
  try {
    await service.rejectSeller(seller.id, invalidFieldKey);
    console.log("Failed: Rejection reason validated but should have failed.");
  } catch (err) {
    console.log("Passed! Expected error received:", err.message);
  }

  // Test Case 4: Empty reason
  const emptyReason = JSON.stringify({
    generalRemark: "Please fix",
    rejectedFields: [
      {
        field: "firstName",
        fieldName: "First Name",
        reason: ""
      }
    ]
  });
  console.log("\nTesting empty reason...");
  try {
    await service.rejectSeller(seller.id, emptyReason);
    console.log("Failed: Rejection reason validated but should have failed.");
  } catch (err) {
    console.log("Passed! Expected error received:", err.message);
  }

  await app.close();
}

bootstrap();

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBranchTransferDto } from './create-branch-transfer.dto';

describe('CreateBranchTransferDto', () => {
  it('should pass validation with a valid UUID for branchId', async () => {
    const dto = plainToInstance(CreateBranchTransferDto, {
      branchId: '123e4567-e89b-12d3-a456-426614174000',
      productId: 'prod-uuid-1234',
      quantity: 10,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with an invalid non-UUID string for branchId', async () => {
    const dto = plainToInstance(CreateBranchTransferDto, {
      branchId: 'invalid-branch-id',
      productId: 'prod-uuid-1234',
      quantity: 10,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const branchIdError = errors.find((e) => e.property === 'branchId');
    expect(branchIdError).toBeDefined();
    expect(branchIdError?.constraints?.isUuid).toBeDefined();
  });
});

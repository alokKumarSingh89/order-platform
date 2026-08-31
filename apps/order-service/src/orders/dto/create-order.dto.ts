import { IsInt, IsNumber, IsPositive } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  @IsPositive()
  userId!: number;

  @IsInt()
  @IsPositive()
  productId!: number;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  totalAmount!: number;
}

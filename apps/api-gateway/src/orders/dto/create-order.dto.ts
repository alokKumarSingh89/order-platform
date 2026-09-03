import { IsInt, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  userId!: string;

  @IsString()
  productId!: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @IsPositive()
  totalAmount!: number;
}

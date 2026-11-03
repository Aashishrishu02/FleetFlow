import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Unique email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({ example: 'P@ssword123', description: 'Password with minimum 8 characters' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  password: string;

  @ApiProperty({ example: 'Acme Logistics', description: 'Name of the organization to create' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Organization name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Organization name cannot exceed 100 characters' })
  organizationName: string;

  @ApiPropertyOptional({ example: 'acme-logistics', description: 'Custom unique organization slug (optional)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  @MaxLength(64, { message: 'Organization slug cannot exceed 64 characters' })
  organizationSlug?: string;
}


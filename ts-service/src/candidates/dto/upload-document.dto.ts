import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const VALID_DOCUMENT_TYPES = ['resume', 'cover_letter', 'transcript', 'portfolio', 'other'] as const;

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_DOCUMENT_TYPES)
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  rawText!: string;
}

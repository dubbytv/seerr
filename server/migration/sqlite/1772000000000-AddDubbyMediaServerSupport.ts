import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDubbyMediaServerSupport1772000000000
  implements MigrationInterface
{
  name = 'AddDubbyMediaServerSupport1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD "dubbyMediaId" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "dubbyMediaId4k" varchar`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "dubbyMediaId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "dubbyMediaId"`
    );
  }
}

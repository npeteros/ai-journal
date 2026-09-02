#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c2548a472182a735cf91b148c174b75e99df3ce40a12e4661becb23264643077/contract';
import startContract from '../../snapshots/c2548a472182a735cf91b148c174b75e99df3ce40a12e4661becb23264643077/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d41654b26e6b60d605ae65316558a19693014e27cdb771b09d228ea2484d89ad/contract';
import endContract from '../../snapshots/d41654b26e6b60d605ae65316558a19693014e27cdb771b09d228ea2484d89ad/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropColumn({ schema: 'public', table: 'user', column: 'passwordHash' })];
  }
}

MigrationCLI.run(import.meta.url, M);

// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_mysterious_blob.sql';
import m0001 from './0001_aromatic_the_watchers.sql';
import m0002 from './0002_serving_amount_unit.sql';
import m0003 from './0003_meal_log_quantity.sql';
import m0004 from './0004_serving_weight_g.sql';
import m0005 from './0005_foods_hard_delete.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }

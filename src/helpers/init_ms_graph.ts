import { EntraConfig, MicrosoftGraph } from 'upsignon-ms-entra';
import { db } from './db';

export const setupMSGraph = () => {
  MicrosoftGraph.getMSEntraConfigForGroup = async (bankId: number): Promise<EntraConfig | null> => {
    const entraConfigRes = await db.query('SELECT ms_entra_config FROM banks WHERE id=$1', [
      bankId,
    ]);
    const entraConfig: EntraConfig | null = entraConfigRes.rows[0]?.ms_entra_config || null;
    return entraConfig;
  };
};

export type ShamirChangeSignature = {
  holderVaultId: number;
  signedAt: string;
  approved: boolean;
  signature: string;
};

export type ShamirShareholderFootprint = {
  vaultId: number;
  vaultEmail: string;
  vaultBankPublicId: string;
  vaultSigningPubKey: string;
  nbShares: number;
};

export type ShamirConfigFootprint = {
  configId: number;
  configName: string;
  bankPublicId: string;
  createdAt: string;
  minShares: number;
  supportEmail: string;
  creatorEmail: string;
  shareholders: ShamirShareholderFootprint[];
};
export type ShamirChange = {
  previousShamirConfig: null | ShamirConfigFootprint;
  thisShamirConfig: ShamirConfigFootprint;
};

///////////////////////////////////////////////////
export type ShamirHolder = {
  vaultId: number;
  nbShares: number;
  publicSigningKey: string;
};

export type ShamirConfigWithHolders = {
  id: number;
  name: string;
  minShares: number;
  isActive: boolean;
  supportEmail: string;
  creatorEmail: string;
  createdAt: string;
  change: string;
  changeSignatures: ShamirChangeSignature[];
  activeHolders: ShamirHolder[];
};

export type ShamirConfigHistoryForBank = {
  bank_id: number;
  public_id: string;
  bank_name: string;
  all_configs: ShamirConfigWithHolders[];
};

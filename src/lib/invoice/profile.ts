import { DEFAULT_ACCENT } from './constants';
import { DEFAULT_SERIES } from './numbering';
import type { Profile } from './profile-schema';

export type { ClientRecord, Profile } from './profile-schema';
export type { Template } from './constants';

export function defaultProfile(now: string): Profile {
  return {
    id: 'default',
    supplier: { name: '', address: '', email: '', phone: '', gstin: '', pan: '', stateCode: '', udyam: '' },
    bank: {
      accountName: '',
      accountNumber: '',
      ifsc: '',
      bankName: '',
      branch: '',
      swift: '',
      iban: '',
      routing: '',
    },
    upiVpa: '',
    series: { ...DEFAULT_SERIES },
    defaults: {
      gstRate: 1800, // spec default; editable per line
      terms: 'net15',
      unit: 'project',
      currency: 'INR',
      notes: '',
      msme45Days: false,
      footerCredit: true,
      roundOff: false,
    },
    appearance: { template: 'classic', accent: DEFAULT_ACCENT, logo: '', signature: '' },
    updatedAt: now,
  };
}

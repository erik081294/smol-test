// @ts-check
// Pure beslislogica voor account-verwijdering (PLT-11, migratie 0078). De DEFINER-RPC
// `delete_account()` dwingt dit server-side af (bron van waarheid); deze module spiegelt
// het zodat de app vóór het verwijderen een eerlijke impact-samenvatting kan tonen:
// welke huishoudens blokkeren (eerst beheer overdragen), welke volledig worden opgeruimd
// (je bent enig lid) en welke je verlaat (gedeelde content wordt geanonimiseerd).
// Géén React/Supabase/IO hier. Voeding: RPC `account_deletion_preview()`.

export const ROLE_OWNER = 'owner';

/**
 * @typedef {{ householdId: string, name?: string|null, role?: string, memberCount?: number, ownerCount?: number }} Membership
 * @typedef {{ householdId: string, name: string|null }} Bucket
 * @typedef {{ blocked: Bucket[], toDelete: Bucket[], toLeave: Bucket[] }} Classification
 */

/**
 * Deel de huishoudens van een lid in drie emmers in — in exact deze prioriteit:
 *  - toDelete: je bent het énige lid → het huishouden wordt volledig opgeruimd (cascade).
 *  - blocked:  je bent de énige owner én er zijn andere leden → eerst beheer overdragen.
 *  - toLeave:  de rest → je verlaat het; gedeelde content wordt geanonimiseerd.
 * Enig-lid wint van blocked: zonder andere leden kán je niets blokkeren. Kapotte/
 * onvolledige rijen worden overgeslagen (defensief; de RPC blijft de poort).
 * @param {Membership[]} [memberships]
 * @returns {Classification}
 */
export function classifyHouseholds(memberships = []) {
  /** @type {Bucket[]} */ const blocked = [];
  /** @type {Bucket[]} */ const toDelete = [];
  /** @type {Bucket[]} */ const toLeave = [];
  for (const m of memberships) {
    if (!m || typeof m.householdId !== 'string') continue;
    const members = Number.isFinite(m.memberCount) ? /** @type {number} */ (m.memberCount) : 0;
    const owners = Number.isFinite(m.ownerCount) ? /** @type {number} */ (m.ownerCount) : 0;
    const entry = { householdId: m.householdId, name: m.name ?? null };
    if (members <= 1) toDelete.push(entry);
    else if (m.role === ROLE_OWNER && owners <= 1) blocked.push(entry);
    else toLeave.push(entry);
  }
  return { blocked, toDelete, toLeave };
}

/**
 * Mag de verwijdering doorgaan? Alleen als geen enkel huishouden blokkeert.
 * @param {Classification} [c]
 * @returns {boolean}
 */
export function canDeleteAccount(c) {
  return (c?.blocked?.length ?? 0) === 0;
}

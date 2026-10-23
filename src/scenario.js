// Demo city: a 10 km x 10 km grid. Times are minutes from the start of the night shift.
// kind: 'shelter' (night shelter) | 'camp' (relief camp). headcount drives fair-share splits.
// verified: govt/NGO-verified sites get direct delivery; unverified needs are served via food stations.
export const scenario = {
  donors: [
    { id: 'D1', name: 'Banquet Hall',   x: 1.5, y: 1.5 },
    { id: 'D2', name: 'Hostel Mess',    x: 8.5, y: 2.0 },
    { id: 'D3', name: 'City Pharmacy',  x: 5.0, y: 8.8 },
  ],
  shelters: [
    { id: 'S1', name: 'Shelter A',        kind: 'shelter', verified: true,  headcount: 50,  x: 3.5, y: 4.0, need: { meals: 50 },                                     has: { water: true,  fuel: true,  cold: false } },
    { id: 'S2', name: 'Relief Camp B',    kind: 'camp',    verified: true,  headcount: 120, x: 7.5, y: 6.5, need: { meals: 80, ration: 20, formula: 15, bread: 60 }, has: { water: true,  fuel: false, cold: false } },
    { id: 'S3', name: 'Women & Child C',  kind: 'shelter', verified: true,  headcount: 45,  x: 1.5, y: 7.5, need: { meals: 40, ration: 10, formula: 10, medical: 12 }, has: { water: true, fuel: true, cold: true } },
    { id: 'S5', name: 'Riverside Families', kind: 'shelter', verified: false, headcount: 35, x: 9.0, y: 8.6, need: { meals: 35 },                                     has: { water: true,  fuel: false, cold: false } },
  ],
  // Public food stations: anyone can walk in. need = free shelf space per category; stock = on the shelves now.
  stations: [
    { id: 'F1', name: 'Community Fridge',     x: 5.5, y: 4.5, helpline: '+91 00000 11001', hours: 'Open 24 h',      need: { meals: 150, medical: 40, dairy: 40, fruit: 30 }, stock: { dairy: 8, fruit: 6 }, has: { cold: true }, fallback: true },
    { id: 'F2', name: 'Railway Food Station', x: 9.3, y: 4.8, helpline: '+91 00000 11002', hours: '6 am – 11 pm',   need: { meals: 60, bread: 80, fruit: 60, ration: 60, canned: 120, formula: 30 }, stock: { bread: 14, canned: 42, ration: 9 } },
    { id: 'F3', name: 'Market Food Station',  x: 3.2, y: 9.3, helpline: '+91 00000 11003', hours: '7 am – 10 pm',   need: { meals: 60, bread: 80, fruit: 60, ration: 60, canned: 120, formula: 30 }, stock: { canned: 18, formula: 5 } },
  ],
  riders: [
    { id: 'R1', name: 'Asha',   x: 2.5, y: 3.0, vehicle: 'scooter' },
    { id: 'R2', name: 'Imran',  x: 4.0, y: 2.0, vehicle: 'scooter' },
    { id: 'R3', name: 'Priya',  x: 6.5, y: 3.5, vehicle: 'scooter' },
    { id: 'R4', name: 'Rahul',  x: 7.0, y: 8.0, vehicle: 'scooter' },
    { id: 'R5', name: 'Sneha',  x: 2.0, y: 6.0, vehicle: 'auto' },
    { id: 'R6', name: 'Kabir',  x: 3.0, y: 1.0, vehicle: 'scooter' },
    { id: 'R7', name: 'Meera',  x: 6.0, y: 6.0, vehicle: 'scooter' },
    { id: 'R9', name: 'Arjun',  x: 4.5, y: 6.5, vehicle: 'cycle' },
    { id: 'R8', name: 'Dev',    x: 7.0, y: 3.5, vehicle: 'scooter', speed: 22, standby: true },
  ],
  batches: [
    { id: 'B1', donorId: 'D1', category: 'meals',   qty: 180, expiresAt: 75 },
    { id: 'B2', donorId: 'D2', category: 'meals',   qty: 60,  expiresAt: 50 },
    { id: 'B3', donorId: 'D2', category: 'ration',  qty: 25,  expiresAt: 600 },
    { id: 'B4', donorId: 'D3', category: 'medical', qty: 12,  expiresAt: 120 },
  ],
};

// Demo city: a 10 km x 10 km grid. Times are minutes from the start of the night shift.
export const scenario = {
  donors: [
    { id: 'D1', name: 'Banquet Hall',   x: 1.5, y: 1.5 },
    { id: 'D2', name: 'Hostel Mess',    x: 8.5, y: 2.0 },
    { id: 'D3', name: 'City Pharmacy',  x: 5.0, y: 8.8 },
  ],
  shelters: [
    { id: 'S1', name: 'Shelter A',        x: 3.5, y: 4.0, need: { meals: 50 },                            has: { water: true,  fuel: true,  cold: false } },
    { id: 'S2', name: 'Relief Camp B',    x: 7.5, y: 6.5, need: { meals: 80, ration: 20, formula: 15 },   has: { water: true,  fuel: false, cold: false } },
    { id: 'S3', name: 'Women & Child C',  x: 1.5, y: 7.5, need: { meals: 40, ration: 10, formula: 10, medical: 12 }, has: { water: true, fuel: true, cold: true } },
    { id: 'S4', name: 'Community Fridge', x: 5.5, y: 4.5, need: { meals: 150, medical: 40 },              has: { water: false, fuel: false, cold: true }, fallback: true },
  ],
  riders: [
    { id: 'R1', name: 'Asha',   x: 2.5, y: 3.0, capacity: 40, speed: 20 },
    { id: 'R2', name: 'Imran',  x: 4.0, y: 2.0, capacity: 40, speed: 20 },
    { id: 'R3', name: 'Priya',  x: 6.5, y: 3.5, capacity: 40, speed: 20 },
    { id: 'R4', name: 'Rahul',  x: 7.0, y: 8.0, capacity: 40, speed: 20 },
    { id: 'R5', name: 'Sneha',  x: 2.0, y: 6.0, capacity: 60, speed: 18 },
    { id: 'R6', name: 'Kabir',  x: 3.0, y: 1.0, capacity: 40, speed: 20 },
    { id: 'R7', name: 'Meera',  x: 6.0, y: 6.0, capacity: 40, speed: 20 },
    { id: 'R8', name: 'Dev',    x: 7.0, y: 3.5, capacity: 40, speed: 22, standby: true },
  ],
  batches: [
    { id: 'B1', donorId: 'D1', category: 'meals',   qty: 180, expiresAt: 75 },
    { id: 'B2', donorId: 'D2', category: 'meals',   qty: 60,  expiresAt: 50 },
    { id: 'B3', donorId: 'D2', category: 'ration',  qty: 25,  expiresAt: 600 },
    { id: 'B4', donorId: 'D3', category: 'medical', qty: 12,  expiresAt: 120 },
  ],
};

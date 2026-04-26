const coffeeItems = [
  { id: 1, name: "Flat White", 
    description: "Double shot of espresso with micro-foam. Smooth and velvety.", 
    price: 3.80 },
  { id: 2, name: "Cortado", 
    description: "Equal parts espresso and warm milk. Perfect balance.", 
    price: 3.40 },
  { id: 3, name: "Single Origin Filter", 
    description: "V60 hand-poured seasonal selection from our roasting partners.", 
    price: 4.20 },
  { id: 4, name: "Cold Brew", 
    description: "18-hour steep, served over large ice with a citrus twist.", 
    price: 4.55 },
  { id: 5, name: "Batch Brew", 
    description: "Fast, fresh, and reliable. Rotating daily beans.", 
    price: 3.00 },
  { id: 6, name: "Oat Cortado", 
    description: "Silky oat milk meets a ristretto double. Dairy-free.", 
    price: 4.20 }
];

const pastryItems = [
  { id: 7, name: "Butter Croissant", 
    description: "Flaky, laminated, baked fresh every morning.", 
    price: 2.80 },
  { id: 8, name: "Pain au Chocolat", 
    description: "Dark Valrhona chocolate inside buttery pastry layers.", 
    price: 3.20 },
  { id: 9, name: "Almond Tart", 
    description: "Frangipane cream with toasted almond flakes.", 
    price: 3.50 },
  { id: 10, name: "Banana Bread", 
    description: "Spelt flour, walnuts, dark chocolate chip.", 
    price: 2.50 }
];

const openingHours = [
  { day: "Mon – Fri", hours: "07:00 → 19:00" },
  { day: "Saturday", hours: "08:00 → 18:00" },
  { day: "Sunday",   hours: "09:00 → 17:00" }
];

export const getMenu = async () => {
  // Artificial delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return { coffeeItems, pastryItems, openingHours };
};

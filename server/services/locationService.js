const locationData = {
  address: {
    line1: "Arch 42, Southwark Bridge Road",
    line2: "London SE1 0ES"
  },
  transport: [
    "5 min walk from London Bridge Underground Station"
  ],
  photos: [
    { 
      id: 1, 
      url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=700", 
      alt: "Café interior warm lighting" 
    },
    { 
      id: 2, 
      url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=700", 
      alt: "Barista preparing coffee" 
    }
  ],
  mapEmbedUrl: "https://maps.google.com/maps?q=Southwark+Bridge+Road+London+SE1&output=embed"
};

export const getLocation = async () => {
  // Artificial delay
  await new Promise(resolve => setTimeout(resolve, 600));
  return locationData;
};

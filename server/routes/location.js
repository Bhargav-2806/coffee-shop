import express from 'express';
import { getLocation } from '../services/locationService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const location = await getLocation();
    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: "Location unavailable" });
  }
});

export default router;

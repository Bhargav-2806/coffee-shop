import express from 'express';
import { getMenu } from '../services/menuService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const menu = await getMenu();
    res.json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: "Menu unavailable" });
  }
});

export default router;

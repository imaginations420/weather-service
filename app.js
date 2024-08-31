const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const databasePath = path.join(__dirname, 'weather.db');
const app = express();
app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    await database.exec(`
      CREATE TABLE IF NOT EXISTS weather (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city TEXT UNIQUE NOT NULL,
        temperature REAL NOT NULL,
        description TEXT NOT NULL
      )
    `);

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/');
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

// Fetch weather data from the Weatherstack API
const fetchWeatherData = async (city) => {
  const apiUrl = `http://api.weatherstack.com/current?access_key=${process.env.WEATHERSTACK_API_KEY}&query=${city}`;
  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    throw new Error('Error fetching data from the Weatherstack API');
  }
};

// update weather data
const saveWeatherData = async (city, temperature, description) => {
  await database.run(
    `INSERT OR REPLACE INTO weather (city, temperature, description) VALUES (?, ?, ?)`,
    [city, temperature, description]
  );
};

// Get weather information
app.get('/', async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: 'Please provide a city name' });
  }

  try {
    const weatherData = await fetchWeatherData(city);
    if (weatherData.error) {
      return res.status(404).json({ error: 'City not found' });
    }

    const { name: cityName } = weatherData.location;
    const { temperature, weather_descriptions } = weatherData.current;

    const description = weather_descriptions[0];
    await saveWeatherData(cityName, temperature, description);

    res.json({
      city: cityName,
      temperature,
      description,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initializeDbAndServer();

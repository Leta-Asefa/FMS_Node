const express = require('express');
const multer  = require('multer');
const path = require('path');

const app = express();

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/') // specify the directory where you want to store uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
})

// Initialize multer upload
const upload = multer({ storage: storage });

// POST route to handle file upload
app.post('/upload', upload.single('image'), function (req, res) {
  // req.file contains information about the uploaded file
  res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});












//--------------------------------Add Site Component -------------------------------------------------
import React, { useState, useEffect } from 'react';
import {useLocation} from 'react-router-dom'
import '../output.css'; // Import custom styles

const DisplaySites = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const location=useLocation()
    const username=location.state?.username

  useEffect(() => {
    const fetchSites = async () => {
      try {
          const response = await fetch('http://localhost:4000/site/all');
          
        if (!response.ok) {
          throw new Error('Failed to fetch sites');
        }
        const data = await response.json();
        setSites(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchSites();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="site-container">
          <h1 className="text-center text-2xl font-bold mb-10">Welcome <b className='text-3xl'>{username}</b> Here Is Your Sites List To Choose</h1>
      <div className="site-grid">
        {sites.map((site) => (
          <div key={site._id} className="bg-white shadow-lg rounded-lg p-4 site-hover">
            <h2 className="text-xl font-semibold mb-2">{site.siteName}</h2>
            <p className="text-gray-700 mb-2">{site.description}</p>
            <p className="text-gray-700 mb-2"><strong>Address:</strong> {site.location.address}</p>
            <p className="text-gray-700 mb-2"><strong>Coordinates:</strong> {site.location.coordinates.join(', ')}</p>
            <p className="text-gray-700 mb-2"><strong>Distance:</strong> {site.distance} km</p>
            <p className="text-gray-700 mb-2"><strong>Opening Hours:</strong> {site.openingHours}</p>
            <p className="text-gray-700 mb-2"><strong>Categories:</strong> {site.categories}</p>
            <p className="text-gray-700 mb-2"><strong>Facilities:</strong> {site.facilitiesAvailable.join(', ')}</p>
            <p className="text-gray-700 mb-2"><strong>Rating:</strong> {site.rating}</p>
            {site.images.length > 0 && <img src={site.images[0]} alt={site.siteName} className="w-full h-48 object-cover mb-2 rounded-lg" />}
            <p className="text-gray-700 mb-2"><strong>Transportations:</strong> {site.transportations.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DisplaySites;

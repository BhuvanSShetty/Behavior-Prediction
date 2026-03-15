import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';


export const predict = async (req, res) => {
    try {
        const { features } = req.body;
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, { features });
        res.json(response.data);
    } catch (err) {
        res.status(503).json({ message: 'ML service unavailable', error: err.message });
    }
};


export const mlHealth = async (req, res) => {
    try {
        const response = await axios.get(`${ML_SERVICE_URL}/health`);
        res.json({ status: 'ML service reachable', data: response.data });
    } catch (err) {
        res.status(503).json({ status: 'ML service unreachable', error: err.message });
    }
};

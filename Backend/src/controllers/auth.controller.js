import User from '../models/user.model.js';
import { generateToken } from '../middleware/auth.middleware.js';


export const register = async (req, res) => {
    try {
        const { name, email, password, role, ageGroup, parentCode } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered' });

        const user = new User({ name, email, password, role, ageGroup });

        // If child provides a parentCode (parent's userId), link them
        if (role === 'child' && parentCode) {
            const parent = await User.findById(parentCode);
            if (parent && parent.role === 'parent') {
                user.parentId = parent._id;
                parent.children.push(user._id);
                await parent.save();
            }
        }

        await user.save();

        res.status(201).json({
            token: generateToken(user._id),
            user: { id: user._id, name, email, role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const match = await user.comparePassword(password);
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });

        res.json({
            token: generateToken(user._id),
            user: { id: user._id, name: user.name, email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const getMe = async (req, res) => {
    res.json(req.user);
};

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['child', 'parent'], default: 'child' },

    // Child-specific
    ageGroup: { type: String, enum: ['10-12', '13-15', '16-18','19-24','24+'], default: '13-15' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Parent-specific: list of linked children
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Parental control settings
    controls: {
        dailyLimitMinutes: { type: Number, default: 120 },
    },

}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (plain) {
    return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);

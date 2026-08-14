import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { IUser, IUserMethods, IUserDocument } from '../interfaces/index.js';

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        name: { type: String, required: true, index: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['child', 'parent', 'admin'], default: 'child' },

        // Child-specific
        ageGroup: {
            type: String,
            enum: ['10-12', '13-15', '16-18', '19-24', '24+'],
            default: '13-15',
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        // Parent-specific: list of linked children
        children: [{ type: Schema.Types.ObjectId, ref: 'User' }],

        // Parental control settings
        controls: {
            dailyLimitMinutes: { type: Number, default: 120 },
        },
    },
    { timestamps: true },
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (
    this: IUserDocument,
    plain: string,
): Promise<boolean> {
    return bcrypt.compare(plain, this.password);
};

const User = mongoose.model<IUser, UserModel>('User', userSchema);

export default User;

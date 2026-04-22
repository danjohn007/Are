import bcrypt from 'bcrypt';
import * as userModel from '../models/userModel.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../services/tokenService.js';

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const payload = { id: user.id, role: user.role, email: user.email };
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);

  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
}

export async function refreshToken(req, res) {
  const { refreshToken: token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  try {
    const payload = verifyRefreshToken(token);
    const newAccessToken = createAccessToken({ id: payload.id, role: payload.role, email: payload.email });
    return res.status(200).json({ success: true, data: { accessToken: newAccessToken } });
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
}

export async function me(req, res) {
  const user = await userModel.findById(req.user.id);
  return res.status(200).json({ success: true, data: user });
}

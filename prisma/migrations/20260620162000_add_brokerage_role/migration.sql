-- Add dedicated brokerage user role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BROKERAGE';

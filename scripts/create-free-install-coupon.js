#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createFreeInstallCoupon() {
  console.log('🚀 Creating Free Install Coupon...\n');

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: 'FREEINSTALL',
        type: 'FIXED',
        value: 150, // $150 fixed discount (covers typical install price)
        maxUses: null, // unlimited uses
        isActive: true,
        description: 'Free sign installation offer - Seattle area'
      }
    });

    console.log('✅ Coupon Created Successfully!\n');
    console.log(`   Code: ${coupon.code}`);
    console.log(`   Type: ${coupon.type}`);
    console.log(`   Value: $${coupon.value}`);
    console.log(`   Max Uses: Unlimited`);
    console.log(`   Status: ${coupon.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Description: ${coupon.description}`);
    console.log(`   ID: ${coupon.id}\n`);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('⚠️  Coupon with code "FREEINSTALL" already exists!');
      
      // Try to fetch and display it
      const existing = await prisma.coupon.findUnique({
        where: { code: 'FREEINSTALL' }
      });
      
      if (existing) {
        console.log(`\n📋 Existing Coupon:\n`);
        console.log(`   Code: ${existing.code}`);
        console.log(`   Type: ${existing.type}`);
        console.log(`   Value: $${existing.value}`);
        console.log(`   Status: ${existing.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   Uses: ${existing.usedCount}/${existing.maxUses || 'Unlimited'}`);
      }
    } else {
      console.error('❌ Error creating coupon:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createFreeInstallCoupon();

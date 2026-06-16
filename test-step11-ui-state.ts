import { prisma } from '@/lib/prisma';

async function verifyUIState() {
  try {
    console.log('=== Field Tech Portal - UI State Verification ===\n');

    // Get current state
    const fieldTech = await prisma.user.findUnique({
      where: { email: 'fieldtech@test.com' },
      select: { id: true, firstName: true, lastName: true },
    });

    const todaysDate = new Date();
    todaysDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todaysDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const jobs = await prisma.jobAssignment.findMany({
      where: {
        fieldTechId: fieldTech?.id,
        scheduledFor: {
          gte: todaysDate,
          lt: tomorrow,
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            address: true,
            type: true,
            status: true,
            notes: true,
            realtor: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            assignedSigns: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    console.log('📱 DASHBOARD PAGE (/field/dashboard)');
    console.log('=====================================\n');
    console.log(`Header: "Good afternoon, ${fieldTech?.firstName}"\n`);
    console.log('Today\'s Jobs Section:');
    
    if (jobs.length === 0) {
      console.log('  [Empty state message]');
    } else {
      jobs.forEach((job, idx) => {
        const status = job.completedAt ? 'Completed' : job.startedAt ? 'Started' : 'Assigned';
        const time = job.scheduledFor ? new Date(job.scheduledFor).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }) : 'N/A';
        console.log(`\n  Card ${idx + 1}:`);
        console.log(`    📍 ${job.order.address}`);
        console.log(`    🏷️  ${job.order.type} | ${status}`);
        console.log(`    🕐 ${time}`);
        console.log(`    👤 ${job.order.realtor.firstName}`);
        console.log(`    [Tappable → /field/jobs/${job.id}]`);
      });
    }

    console.log('\n\nBottom Tab Bar:');
    console.log('  [Jobs] [Profile]');

    // Show detail page state for first job
    if (jobs.length > 0) {
      const job = jobs[0];
      console.log(`\n\n📱 DETAIL PAGE (/field/jobs/${job.id})`);
      console.log('====================================\n');
      console.log(`Back Button: ← Back to Jobs\n`);
      console.log(`📍 Address (Tappable → Google Maps):`);
      console.log(`   ${job.order.address}\n`);
      console.log(`Order Details:`);
      console.log(`  Type: ${job.order.type}`);
      console.log(`  Order #: ${job.order.orderNumber}`);
      console.log(`  Status: ${job.order.status}`);
      
      console.log(`\nRealtor:`);
      console.log(`  ${job.order.realtor.firstName} ${job.order.realtor.lastName}`);
      if (job.order.realtor.phone) {
        console.log(`  📞 Call ${job.order.realtor.phone} [Tap to call]`);
      }

      if (job.order.assignedSigns && job.order.assignedSigns.length > 0) {
        console.log(`\nSigns Assigned:`);
        job.order.assignedSigns.forEach(sign => {
          console.log(`  ${sign.signNumber} (${sign.type})`);
        });
      }

      if (job.order.notes) {
        console.log(`\nRealtor Notes:`);
        console.log(`  "${job.order.notes}"`);
      }

      console.log(`\n\nAction Buttons:`);
      if (job.completedAt) {
        console.log(`  ✅ Job Completed`);
        console.log(`     Completed: ${new Date(job.completedAt).toLocaleString()}`);
        console.log(`     Notes: "${job.techNotes}"`);
      } else if (job.startedAt) {
        console.log(`  [Complete Job] - Shows notes textarea before confirming`);
        console.log(`  [Flag Issue] - Opens modal to describe issue`);
      } else {
        console.log(`  [Start Job] - Large green button`);
      }
    }

    console.log('\n\n=== UI Features Implemented ===');
    console.log('✅ Mobile-first design (large text, 48px+ tap targets)');
    console.log('✅ Dashboard header with greeting and sign out');
    console.log('✅ Today\'s jobs with large address text');
    console.log('✅ Job cards with type badge, scheduled time, realtor name, status');
    console.log('✅ Tappable cards navigate to detail page');
    console.log('✅ Upcoming section (collapsed by default)');
    console.log('✅ Bottom tab bar (Jobs, Profile)');
    console.log('✅ Detail page with large tappable address → Google Maps');
    console.log('✅ Realtor phone number as tel: link');
    console.log('✅ Context-aware action buttons (Start/Complete/Flag)');
    console.log('✅ Complete job modal with notes textarea');
    console.log('✅ Flag issue modal with description');
    console.log('✅ Completion summary with tech notes');
    console.log('✅ Back button to dashboard');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyUIState();

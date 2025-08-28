import { storage } from '../server/storage.js';

async function setupAdmin() {
  console.log('Setting up admin user...');
  
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByEmail('updates@foxxbioprocess.com');
    
    if (existingAdmin) {
      console.log('Admin user already exists. Updating password...');
      await storage.updateUser(existingAdmin.id, {
        password: 'foxxbioprocess@2025',
        role: 'admin',
        isActive: true,
        isEmailVerified: true
      });
    } else {
      console.log('Creating new admin user...');
      const adminUser = await storage.createUser({
        email: 'updates@foxxbioprocess.com',
        password: 'foxxbioprocess@2025',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        permissions: {}
      });
      console.log('Admin user created with ID:', adminUser.id);
      
      // Set up email settings for the admin using the provided secrets
      if (process.env.EMAIL && process.env.PASSWORD) {
        const emailSettings = await storage.createEmailSettings({
          userId: adminUser.id,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          fromEmail: process.env.EMAIL,
          fromName: 'Newsletter Dashboard',
          smtpUsername: process.env.EMAIL,
          smtpPassword: process.env.PASSWORD,
          isConfigured: true
        });
        console.log('Email settings configured for admin');
      }
    }
    
    console.log('Admin setup completed successfully!');
    console.log('Admin credentials:');
    console.log('Email: updates@foxxbioprocess.com');
    console.log('Password: foxxbioprocess@2025');
    
  } catch (error) {
    console.error('Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin();
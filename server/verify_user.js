const prisma = require('./src/config/prisma');

async function checkUser() {
    try {
        console.log("Checking for 'john@doe.com'...");

        // Check User (Admin/Staff)
        const user = await prisma.user.findUnique({ where: { email: 'john@doe.com' } });
        console.log("User Table:", user ? "FOUND" : "NOT FOUND");
        if (user) console.log(" - Role:", user.role);

        // Check Member
        const member = await prisma.member.findUnique({ where: { email: 'john@doe.com' } });
        console.log("Member Table:", member ? "FOUND" : "NOT FOUND");
        if (member) console.log(" - Password Set:", !!member.password);

        // List all members for context
        const allMembers = await prisma.member.findMany({ select: { email: true } });
        console.log("Existing Members:", allMembers.map(m => m.email));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();

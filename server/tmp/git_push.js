const { execSync } = require('child_process');

const commitMessage = `feat: complete system-wide multi-tenancy implementation

Infrastructure & Architecture:
- Core multi-tenancy layer: Implemented gymId-based isolation across all major database models.
- context-aware queries: Automatic gymId filtering for both read and write operations based on the active user session.
- branch isolation: Enforced strict data boundaries to ensure data such as members, payments, and notifications are never leaked across branches.

Feature Localization:
- Branch-specific products: Transitioned from a global inventory model to a localized stock system, enabling independent suppliers and costs for each branch.
- Role-specific access: Refined permissions so trainers/staff are limited to their home branch while Owners maintain top-level oversight across all locations.
- Private communications: Secured the notification system with user-level and branch-level isolation (targetGroup: 'PRIVATE').

Operational Enhancements:
- Multi-branch reporting: fixed Owner visibility for "All Branches" in User Management.
- Performance: Integrated backend pagination into staff management to handle global user lists efficiently.`;

try {
    console.log('Staging changes...');
    execSync('git add .', { cwd: 'e:/OJT Files/gym_pos-1' });
    
    console.log('Committing changes...');
    // Use a temporary file for the commit message to avoid shell escaping issues
    const fs = require('fs');
    const msgFile = 'e:/OJT Files/gym_pos-1/commit_msg.tmp';
    fs.writeFileSync(msgFile, commitMessage);
    
    execSync(`git commit -F "${msgFile}"`, { cwd: 'e:/OJT Files/gym_pos-1' });
    fs.unlinkSync(msgFile);
    
    console.log('Pushing to origin test...');
    execSync('git push origin test', { cwd: 'e:/OJT Files/gym_pos-1' });
    
    console.log('✅ Changes successfully pushed to test branch.');
} catch (error) {
    console.error('❌ Failed to push changes:', error.stdout?.toString() || error.message);
    process.exit(1);
}

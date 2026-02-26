const isDatabaseUnreachableError = (error) => {
    const message = error && error.message ? error.message : '';
    return (
        message.includes("Can't reach database server") ||
        error?.name === 'PrismaClientInitializationError'
    );
};

module.exports = {
    isDatabaseUnreachableError
};

module.exports = {
    presets: [
        ['@babel/preset-env', {
            targets: { node: 'current' },
            modules: 'auto'
        }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
    ],
    plugins: [
        '@babel/plugin-transform-modules-commonjs',
        '@babel/plugin-proposal-class-properties'
    ]
} 
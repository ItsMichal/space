/** @type {import('next').NextConfig} */
const nextConfig = {
    images:{
        remotePatterns:[
            {
                protocol:'https',
                hostname: '**.unsplash.com',
            },
            {
                protocol:'https',
                hostname: '**.notion.so',
            },
            {
                protocol:'https',
                hostname: '**.amazonaws.com',
            },
        ]
    }
}

module.exports = nextConfig

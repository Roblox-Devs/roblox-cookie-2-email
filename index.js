const axios = require('axios');
const readline = require('readline');
const https = require('https');
const agent = new https.Agent({ family: 4 });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getCSRFToken(cookie) {
    return new Promise((resolve, reject) => {
        axios.request({
            url: "https://auth.roblox.com/v2/logout",
            method: "post",
            headers: {
                Cookie: ".ROBLOSECURITY=" + cookie
            }
        }).catch(function (error) {
            resolve(error.response.headers["x-csrf-token"])
        })
    })
}
async function getUserId(cookie) {
    return new Promise((resolve, reject) => {
        axios.request({
            url: "https://users.roblox.com/v1/users/authenticated",
            method: "get",
            headers: {
                Cookie: ".ROBLOSECURITY=" + cookie
            }
        }).then(function (response) {
            resolve(response.data.id)
        }).catch(function (error) {
            console.log("Cookie is not valid")
            process.exit(0)
        })
    })
}


function promptForCookie() {
    return new Promise((resolve) => {
        rl.question('Input your cookie: ', (cookie) => {
            rl.close();
            resolve(cookie);
        });
    });
}
async function fetchLink(cookie) {
    try {
        console.log("Fetching authorization link")
        const response = await axios.post('https://apis.roblox.com/oauth/v1/authorizations', {
            clientId: '7646202829179864033',
            responseTypes: ['Code'],
            redirectUri: 'https://events.roblox.com/integrations/roblox/callback',
            scopes: [
                { scopeType: 'openid', operations: ['read'] },
                { scopeType: 'profile', operations: ['read'] },
                { scopeType: 'email', operations: ['read'] }
            ],
            state: 'https://events.roblox.com/home/profile',
            resourceInfos: [
                {
                    owner: { id: await getUserId(cookie), type: 'User' },
                    resources: {}
                }
            ]
        }, {
            headers: {
                accept: '*/*',
                'Cookie': '.ROBLOSECURITY=' + cookie,
                'accept-language': 'en-US,en;q=0.5',
                'cache-control': 'no-cache',
                'content-type': 'application/json-patch+json',
                pragma: 'no-cache',
                'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'sec-gpc': '1',
                'x-csrf-token': await getCSRFToken(cookie)
            },
            referrer: 'https://authorize.roblox.com/',
            referrerPolicy: 'strict-origin-when-cross-origin',
            mode: 'cors',
            credentials: 'include'
        });
        console.log("Authorization link fetched! Cookie is valid and time2continue...")
        return response.data.location;
    } catch (error) {
        console.error("Cannot fetch authorization link, please try again (or this isn't a valid cookie, OR acc has no linked email or account is under 13)");
        process.exit(0)
    }
}
async function getToken(url, cookie) {
    const headers = {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Cookie': '.ROBLOSECURITY=' + cookie,
        Referer: 'https://events.roblox.com/home/profile',
        Traceparent: '',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    };

    const config = {
        method: 'get',
        url: url,
        headers,
        httpsAgent: agent,
        maxRedirects: 1000,
    };
    try {
        const response = await axios(config);
        if (response.data.includes("Complete Your Sign-Up ")) {
            const idRegex = /"email":"([^"]+)"/;
            console.log("Email: " + idRegex.exec(response.data)[1])
            process.exit(0)
        }
        const idRegex = /"id":"([^"]+)"/;
        const tokenRegex = /"token":"([^"]+)"/;
        const reg = idRegex.exec(response.data);
        const match = tokenRegex.exec(response.data);
        console.log(match[0])
        axios.post('https://api.sfelc.com/graphql', {
            "operationName": "MyTenantUser",
            "variables": {
                "tenantId": `${reg[1]}`
            },
            "query": "query MyTenantUser($tenantId: MongoID!) { tenantUser: myTenantUser(tenantId: $tenantId) { id tenantId userId displayName firstName lastName pictureUrl headline position linkedInUrl: linkedinProfileUrl company { id name __typename } ...TenantUserLocationFragment user { id email __typename } approved type signUpAt onboardingAt __typename } } fragment TenantUserLocationFragment on LVTenantUser { city state country displayLocation __typename }"
        }, {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.5",
                "authorization": `Bearer ${match[1]}`,
                "cache-control": "no-cache",
                "content-type": "application/json",
                "pragma": "no-cache",
                "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Brave\";v=\"114\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "cross-site",
                "sec-gpc": "1",
                "x-client": "Gradual - 0.428.0",
            },
            "referrer": "https://events.roblox.com/",
            "referrerPolicy": "origin-when-cross-origin",
            "credentials": "include",
            "httpsAgent": agent,
        })
            .then(response => {
                console.log("Email: " + response.data.data.tenantUser.user.email);
                process.exit(0);
            })
            .catch(error => {
                console.log("i have no idea how this happened, please report it to GitHub");
                process.exit(0);
            });
    } catch (error) {
        console.error("i have no idea how this happened, please report it to GitHub");
        throw error;
    }
}


async function main() {
    try {
        const cookie = await promptForCookie();
        const verificationLink = await fetchLink(cookie);
        await getToken(verificationLink, cookie);
    } catch (error) {
        console.error('error (report to github): ', error);
	process.exit(0);
    }
}

main();

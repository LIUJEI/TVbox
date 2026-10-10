// 小苹果 (122.228.193.211:18008) - QuickJS 版 (原 小苹果.py)
// 原生App协议: protobuf + AES-128/256 + RSA + HMAC-SHA256, 全部纯JS实现
// 依赖 TVBox req 能力: postType:"base64" (二进制body), buffer:2 (base64响应)

// ==================== 基础编码 ====================
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64enc(bytes) {
    let out = "", i = 0;
    for (; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63] + B64C[(n >> 6) & 63] + B64C[n & 63];
    }
    if (i < bytes.length) {
        const n = (bytes[i] << 16) | (i + 1 < bytes.length ? bytes[i + 1] << 8 : 0);
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64C[(n >> 6) & 63] : "=";
        out += "=";
    }
    return out;
}
function b64dec(s) {
    const rev = {};
    for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
    s = String(s).replace(/[^A-Za-z0-9+/]/g, "");
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
        acc = (acc << 6) | rev[s[i]];
        bits += 6;
        if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return out;
}
function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
        else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
            c = 0x10000 + ((c & 0x3FF) << 10) + (str.charCodeAt(++i) & 0x3FF);
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}
function utf8dec(bytes) {
    let out = "", i = 0;
    while (i < bytes.length) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xE0) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xF0) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        else { i += 3; out += ""; }
    }
    return out;
}
function hexenc(bytes) { let s = ""; for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16); return s; }

// ==================== AES ====================
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const INV_SBOX = [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];
function xtime(x) { x <<= 1; return x & 256 ? (x ^ 0x11b) & 255 : x; }
function aesKeyExp(key) {
    const Nk = key.length / 4, Nr = Nk + 6, w = [];
    for (let i = 0; i < Nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % Nk === 0) {
            t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
            t[0] ^= RCON[i / Nk];
        } else if (Nk > 6 && i % Nk === 4) {
            t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
        }
        w.push([w[i - Nk][0] ^ t[0], w[i - Nk][1] ^ t[1], w[i - Nk][2] ^ t[2], w[i - Nk][3] ^ t[3]]);
    }
    return { w: w, Nr: Nr };
}
function aesAddRK(s, w, r) { for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) s[i + 4 * c] ^= w[4 * r + c][i]; }
function aesSub(s) { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function aesInvSub(s) { for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
function aesShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c + r) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesInvShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c - r + 4) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesMix(s) {
    for (let c = 0; c < 4; c++) {
        const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
        s[4 * c] = xtime(a[0]) ^ (xtime(a[1]) ^ a[1]) ^ a[2] ^ a[3];
        s[1 + 4 * c] = a[0] ^ xtime(a[1]) ^ (xtime(a[2]) ^ a[2]) ^ a[3];
        s[2 + 4 * c] = a[0] ^ a[1] ^ xtime(a[2]) ^ (xtime(a[3]) ^ a[3]);
        s[3 + 4 * c] = (xtime(a[0]) ^ a[0]) ^ a[1] ^ a[2] ^ xtime(a[3]);
    }
}
function aesInvMix(s) {
    for (let c = 0; c < 4; c++) {
        const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
        const m9 = (x) => xtime(xtime(xtime(x))) ^ x;
        const m11 = (x) => xtime(xtime(xtime(x))) ^ xtime(x) ^ x;
        const m13 = (x) => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ x;
        const m14 = (x) => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ xtime(x);
        s[4 * c] = m14(a[0]) ^ m11(a[1]) ^ m13(a[2]) ^ m9(a[3]);
        s[1 + 4 * c] = m9(a[0]) ^ m14(a[1]) ^ m11(a[2]) ^ m13(a[3]);
        s[2 + 4 * c] = m13(a[0]) ^ m9(a[1]) ^ m14(a[2]) ^ m11(a[3]);
        s[3 + 4 * c] = m11(a[0]) ^ m13(a[1]) ^ m9(a[2]) ^ m14(a[3]);
    }
}
function pkcs7pad(bytes) {
    const n = 16 - (bytes.length % 16), out = bytes.slice();
    for (let i = 0; i < n; i++) out.push(n);
    return out;
}
function pkcs7unpad(bytes) {
    if (!bytes.length) return bytes;
    const n = bytes[bytes.length - 1];
    if (n < 1 || n > 16 || n > bytes.length) return bytes;
    return bytes.slice(0, bytes.length - n);
}
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.Nr; r++) { aesSub(s); aesShift(s); aesMix(s); aesAddRK(s, ek.w, r); }
    aesSub(s); aesShift(s); aesAddRK(s, ek.w, ek.Nr);
    return s;
}
function aesDecBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, ek.Nr);
    for (let r = ek.Nr - 1; r >= 1; r--) { aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, r); aesInvMix(s); }
    aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, 0);
    return s;
}
function aesEcbEnc(key, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    for (let i = 0; i < data.length; i += 16) { const b = aesEncBlock(ek, data.slice(i, i + 16)); for (const x of b) out.push(x); }
    return out;
}
function aesEcbDec(key, bytes) {
    const ek = aesKeyExp(key), out = [];
    for (let i = 0; i + 16 <= bytes.length; i += 16) { const b = aesDecBlock(ek, bytes.slice(i, i + 16)); for (const x of b) out.push(x); }
    return pkcs7unpad(out);
}
function aesCbcEnc(key, iv, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    let prev = iv.slice();
    for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        for (let j = 0; j < 16; j++) block[j] ^= prev[j];
        prev = aesEncBlock(ek, block);
        for (const x of prev) out.push(x);
    }
    return out;
}
function aesCbcDec(key, iv, bytes) {
    const ek = aesKeyExp(key), out = [];
    let prev = iv.slice();
    for (let i = 0; i + 16 <= bytes.length; i += 16) {
        const block = bytes.slice(i, i + 16);
        const dec = aesDecBlock(ek, block);
        for (let j = 0; j < 16; j++) out.push(dec[j] ^ prev[j]);
        prev = block;
    }
    return pkcs7unpad(out);
}

// ==================== RSA (BigInt modpow, PKCS1 v1.5) ====================
const RSA_N = BigInt("0x9db8d1277f119a2ee411939001cd71e13d5e37ce2d34b021e32e8f0161cf968bac579b66f8bf48b6f12ab85a53422a1b1e7edf5fcfc90efea2ebebfd36da8d5172e394edee0614bdd4f569cd383c1105849859df8af27aa923fb405039991011915aa8eb73bc7a68c97703ec699d690b6cf08bb2e85bbae504dedbf4f6878ea7");
function rsaEncrypt(msgBytes) {
    const k = 128;
    const ps = [];
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    let m = 0n;
    const em = [0, 2].concat(ps).concat([0]).concat(msgBytes);
    for (const b of em) m = (m << 8n) | BigInt(b);
    let r = 1n, base = m % RSA_N, e = 65537n;
    while (e > 0n) { if (e & 1n) r = r * base % RSA_N; base = base * base % RSA_N; e >>= 1n; }
    let hex = r.toString(16);
    while (hex.length < 256) hex = "0" + hex;
    const out = [];
    for (let i = 0; i < 256; i += 2) out.push(parseInt(hex.substring(i, i + 2), 16));
    return out;
}

// ==================== SHA-256 + HMAC ====================
const SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256(bytes) {
    const data = bytes.slice();
    const bitLen = data.length * 8;
    data.push(0x80);
    while (data.length % 64 !== 56) data.push(0);
    for (let i = 7; i >= 0; i--) data.push(Math.floor(bitLen / Math.pow(256, i)) & 255);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
    for (let off = 0; off < data.length; off += 64) {
        const w = [];
        for (let i = 0; i < 16; i++) w.push(((data[off + 4 * i] << 24) | (data[off + 4 * i + 1] << 16) | (data[off + 4 * i + 2] << 8) | data[off + 4 * i + 3]) >>> 0);
        for (let i = 16; i < 64; i++) {
            const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w.push((w[i - 16] + s0 + w[i - 7] + s1) >>> 0);
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + SHA_K[i] + w[i]) >>> 0;
            const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
            const mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + mj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h = h.map((x, i) => (x + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    const out = [];
    for (const x of h) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
    return out;
}
function hmacSha256(keyBytes, msgBytes) {
    let key = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes.slice();
    while (key.length < 64) key.push(0);
    const ipad = key.map(b => b ^ 0x36), opad = key.map(b => b ^ 0x5c);
    return sha256(opad.concat(sha256(ipad.concat(msgBytes))));
}

// ==================== protobuf ====================
function varintEnc(n) {
    n = BigInt(n);
    const out = [];
    while (true) {
        const x = Number(n & 0x7fn);
        n >>= 7n;
        if (n > 0n) out.push(x | 0x80);
        else { out.push(x); return out; }
    }
}
function fldEnc(num, wire, payload) {
    const t = varintEnc((num << 3) | wire);
    if (wire === 2) return t.concat(varintEnc(payload.length)).concat(payload);
    return t.concat(payload);
}
function pbParse(buf) {
    const out = [];
    let i = 0;
    while (i < buf.length) {
        try {
            let tagBig = 0n, sh = 0n;
            while (true) { const b = buf[i++]; tagBig |= BigInt(b & 0x7f) << sh; sh += 7n; if (!(b & 0x80)) break; }
            const tag = Number(tagBig);
            const fn = tag >> 3, wt = tag & 7;
            if (wt === 0) {
                let v = 0n; sh = 0n;
                while (true) { const b = buf[i++]; v |= BigInt(b & 0x7f) << sh; sh += 7n; if (!(b & 0x80)) break; }
                out.push([fn, wt, Number(v)]);
            } else if (wt === 2) {
                let ln = 0; sh = 0n;
                while (true) { const b = buf[i++]; ln += (b & 0x7f) * Math.pow(2, Number(sh)); sh += 7n; if (!(b & 0x80)) break; }
                out.push([fn, wt, buf.slice(i, i + ln)]);
                i += ln;
            } else if (wt === 5) { out.push([fn, wt, buf.slice(i, i + 4)]); i += 4; }
            else if (wt === 1) { out.push([fn, wt, buf.slice(i, i + 8)]); i += 8; }
            else break;
        } catch (e) { break; }
    }
    return out;
}

// ==================== 小苹果业务 ====================
const HOST = "http://122.228.193.211:18008";
const NATIVE = utf8enc("ed5fdsgucxumegqa");
const DATAIV = utf8enc("OC1A06E197EF10CF3F6058CA7A803B5E");
const DATAKEY = utf8enc("S0VNDTJHOFHHCNMRAW5IV2TOS2PBPQ==");
const UA = "okhttp/3.12.1";
const UDID = hexenc(Array.from({length: 16}, () => Math.floor(Math.random() * 256))).toUpperCase();
const CATES = [["剧集", "2", "c"], ["电影", "1", "c"], ["综艺", "3", "c"], ["动漫", "4", "c"], ["短剧", "5", "c"], ["4K专区", "117", "t"], ["奈飞专区", "115", "t"]];
const CATE_BY_ID = {};
for (const t of CATES) CATE_BY_ID[t[1]] = [t[0], t[2]];
const DEAD_LINES = ["youku"];
const RR_API = "https://api.rrmj.plus";
const RR_SS = utf8enc("ES513W0B1CsdUrR13Qk5EgDAKPeeKZY");
const RR_DK = utf8enc("3b744389882a4067");
const RR_IV = utf8enc("b1da7878016e4e2b");
const RR_REF = "https://mh.yichengwlkj.com/";
const RR_UA = "Mozilla/5.0 (Linux; Android 16; PJX110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const FILTERS = {};
for (const t of CATES) {
    if (t[2] === "c") FILTERS[t[1]] = [{ key: "vodOrderBy", name: "排序", value: [{ n: "最新", v: "最新" }, { n: "最热", v: "最热" }, { n: "评分", v: "评分" }] }];
}
FILTERS["117"] = [{ key: "grp", name: "分组", value: [{ n: "全部", v: "" }, { n: "4K大片", v: "4K大片" }, { n: "4K好剧", v: "4K好剧" }] }];
FILTERS["115"] = [{ key: "area", name: "地区", value: [{ n: "精选", v: "" }, { n: "美剧", v: "美国" }, { n: "韩剧", v: "韩国" }, { n: "日剧", v: "日本" }, { n: "英剧", v: "英国" }] }, { key: "vodOrderBy", name: "排序", value: [{ n: "最新", v: "最新" }, { n: "最热", v: "最热" }] }];

function init(ext) {}

function rndStr(n) {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
}

function paramsData(ts) {
    const r16 = b64enc(utf8enc(rndStr(12)));
    const sig = b64enc(rsaEncrypt(utf8enc(String(ts) + r16 + "1003")));
    const b = b64enc(aesEcbEnc(DATAIV, utf8enc(String(ts) + r16)));
    const J = { country: "CN", vName: "1.0.0.3", cpuId: "", young: 0, facturer: "OnePlus", pkg: "com.juechufsh.android.xpg1", uuid: UDID, resolution: "1080x2256", mac: "02%3A00%3A00%3A00%3A00%3A00", sig: sig, abid: "2557", model: "PJX110", plat: "android", udid: UDID, dpi: "480", net: "1", lang: "zh", random_str: r16, brand: "OnePlus", timestamp: ts, density: "3.0", appName: "%E5%B0%8F%E8%8B%B9%E6%9E%9C%E5%BD%B1%E8%A7%86", cpu: "arm64-v8a", chid: "10000", carrier: "%E8%81%94%E9%80%9A", sig2: b.substring(0, 8), v: 1, sig3: b.substring(8), tenantId: "xpg", _vOsCode: "36", vOs: "16", vApp: "1003", device: 0, androidID: UDID.substring(0, 16).toLowerCase() };
    return hexenc(aesCbcEnc(NATIVE, NATIVE, utf8enc(JSON.stringify(J))));
}

function makeHeaders(ts) {
    return {
        "User-Agent": UA, "Cache-Control": "no-cache",
        "Accept": "application/x-protobuf", "Content-Type": "application/x-protobuf",
        "publicParams": JSON.stringify({ paramsData: paramsData(ts) })
    };
}

function makeBody(kvs, ts) {
    const f8 = rndStr(8);
    const parts = [];
    for (const k in kvs) { if (String(kvs[k])) parts.push(k + "=" + kvs[k]); }
    const sb = parts.join("&");
    const aes = f8 + b64enc(aesEcbEnc(DATAKEY, utf8enc(sb + ts)));
    return fldEnc(1, 2, utf8enc(aes.substring(0, 20)))
        .concat(fldEnc(2, 2, utf8enc(aes.substring(20))))
        .concat(fldEnc(3, 2, utf8enc(rndStr(20))))
        .concat(fldEnc(4, 0, varintEnc(ts)))
        .concat(fldEnc(5, 2, utf8enc(f8)));
}

// 二进制POST: body传Latin-1字符串(每字节一字符), Content-Type带charset=ISO-8859-1使OkHttp按latin1逐字节发送; buffer:2收base64
async function postProto(ep, kvs) {
    try {
        const ts = Date.now();
        const bodyBytes = makeBody(kvs, ts);
        let bodyStr = "";
        for (const b of bodyBytes) bodyStr += String.fromCharCode(b);
        const headers = makeHeaders(ts);
        headers["Content-Type"] = "application/x-protobuf; charset=ISO-8859-1";
        const r = await req(HOST + ep, {
            method: "POST", headers: headers,
            body: bodyStr,
            buffer: 2, timeout: 20
        });
        const c = (r && r.content) || "";
        return c ? b64dec(c) : [];
    } catch (e) { return []; }
}

async function getProto(ep) {
    try {
        const r = await req(HOST + ep, { headers: makeHeaders(Date.now()), buffer: 2, timeout: 20 });
        const c = (r && r.content) || "";
        return c ? b64dec(c) : [];
    } catch (e) { return []; }
}

function dataOf(raw) {
    for (const t of pbParse(raw)) { if (t[0] === 3 && t[1] === 2) return t[2]; }
    return [];
}
function flatOf(g) {
    const m = {};
    for (const t of pbParse(g)) { m[t[0]] = t[1] === 2 ? utf8dec(t[2]) : t[2]; }
    return m;
}
function picsOf(s) {
    return (String(s || "").match(/https?:\/\/[^\x00-\x20"']+/g)) || [];
}
function cardOf(m) {
    const vid = String(m[3] || "");
    if (!vid || !m[5]) return null;
    const p = picsOf(m[2]);
    return { vod_id: vid, vod_name: m[5], vod_pic: p[0] || "", vod_remarks: m[13] || m[26] || "" };
}
function v5listOf(raw) {
    const out = [], seen = {};
    for (const t of pbParse(dataOf(raw))) {
        if (t[0] === 1 && t[1] === 2) {
            const c = cardOf(flatOf(t[2]));
            if (c && !seen[c.vod_id]) { seen[c.vod_id] = 1; out.push(c); }
        }
    }
    return out;
}
function v4listOf(raw, grp) {
    const out = [], seen = {};
    for (const t of pbParse(dataOf(raw))) {
        if (t[0] === 31 && t[1] === 2) {
            let gname = "";
            const items = [];
            for (const t2 of pbParse(t[2])) {
                if (t2[0] === 1 && t2[1] === 2) gname = utf8dec(t2[2]);
                else if (t2[0] === 5 && t2[1] === 2) items.push(t2[2]);
            }
            if (grp && gname !== grp) continue;
            for (const item of items) {
                const c = cardOf(flatOf(item));
                if (c && !seen[c.vod_id]) { seen[c.vod_id] = 1; out.push(c); }
            }
        }
    }
    return out;
}

async function home(filter) {
    const cls = [];
    for (const t of CATES) cls.push({ type_id: t[1], type_name: t[0] });
    return JSON.stringify({ "class": cls, "filters": FILTERS });
}

async function homeVod() {
    const vids = v4listOf(await getProto("/api/proto/v4/tag/list/detail?pagesize=21&id=117&page=1"));
    return JSON.stringify({ list: vids });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const mode = (CATE_BY_ID[String(tid)] || ["", "c"])[1];
    const ex = extend || {};
    let vids = [];
    try {
        if (mode === "t") {
            if (String(tid) === "117") {
                vids = v4listOf(await getProto("/api/proto/v4/tag/list/detail?pagesize=21&id=" + tid + "&page=1"), ex.grp || "");
            } else if (String(tid) === "115") {
                const area = ex.area || "";
                if (area) {
                    vids = v5listOf(await postProto("/api/proto/v5/drama/category", { pagesize: "21", typeId1: "2", page: String(page), vodArea: area, vodOrderBy: ex.vodOrderBy || "最新" }));
                } else if (page === 1) {
                    vids = v4listOf(await getProto("/api/proto/v4/tag/list/detail?pagesize=21&id=" + tid + "&page=1"));
                } else {
                    const areas = ["美国", "韩国", "日本", "英国"];
                    const a = areas[(page - 2) % areas.length];
                    const p2 = Math.floor((page - 2) / areas.length) + 1;
                    vids = v5listOf(await postProto("/api/proto/v5/drama/category", { pagesize: "21", typeId1: "2", page: String(p2), vodArea: a, vodOrderBy: "最新" }));
                }
            } else {
                vids = v4listOf(await getProto("/api/proto/v4/tag/list/detail?pagesize=21&id=" + tid + "&page=" + page));
            }
        } else {
            vids = v5listOf(await postProto("/api/proto/v5/drama/category", { pagesize: "21", typeId1: String(tid), page: String(page), vodOrderBy: ex.vodOrderBy || "最新" }));
        }
        const pc = String(tid) === "117" ? 1 : 9999;
        return JSON.stringify({ list: vids, page: page, pagecount: pc, limit: 21, total: pc === 1 ? vids.length : 999999 });
    } catch (e) {
        return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 21, total: 0 });
    }
}

async function detail(ids) {
    try {
        const vid = String(Array.isArray(ids) ? ids[0] : ids);
        const d = dataOf(await postProto("/api/proto/v5/drama/getDetail", { id: vid }));
        if (!d.length) return JSON.stringify({ list: [] });
        const head = {};
        const eps = [];
        let pic = "";
        for (const t of pbParse(d)) {
            const fn = t[0], wt = t[1], v = t[2];
            if (fn === 29 && wt === 2) eps.push(flatOf(v));
            else if (wt === 2) {
                if (fn === 2) { const p = picsOf(utf8dec(v)); pic = p.length > 1 ? p[1] : (p[0] || ""); }
                else if ([5, 6, 9, 12, 15, 25, 26].indexOf(fn) >= 0) head[fn] = utf8dec(v);
            } else if (wt === 0 && fn === 18) head[18] = String(v);
        }
        const line = {}, order = [];
        for (const e of eps) {
            const src = e[9] || "Ksvideo";
            let dead = false;
            for (const d2 of DEAD_LINES) { if (src.indexOf(d2) >= 0) { dead = true; break; } }
            if (dead) continue;
            const tok = e[4] || "";
            if (!tok) continue;
            const q = e[10] || "";
            const nm = q ? src + "·" + q : src;
            if (!(nm in line)) { line[nm] = []; order.push(nm); }
            const b64 = b64enc(utf8enc(JSON.stringify({ f: src, u: tok })));
            line[nm].push((e[3] || String(line[nm].length + 1)) + "$" + b64);
        }
        if (!order.length) return JSON.stringify({ list: [] });
        const urlParts = [];
        for (const k of order) urlParts.push(line[k].join("#"));
        return JSON.stringify({ list: [{
            vod_id: vid, vod_name: head[9] || "", vod_pic: pic, vod_year: head[18] || "",
            vod_area: head[5] || "", vod_remarks: head[26] || "", vod_actor: head[25] || "",
            vod_director: head[12] || "", vod_content: head[6] || "",
            vod_play_from: order.join("$$$"), vod_play_url: urlParts.join("$$$")
        }] });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

async function vuuGet(pf, pu) {
    const raw = await postProto("/api/proto/v5/videoUsableUrl", { vodPlayFrom: encodeURIComponent(pf), playUrl: encodeURIComponent(pu) });
    const d = dataOf(raw);
    if (!d.length) return "";
    let s = "";
    for (const b of d) s += String.fromCharCode(b);
    const m = s.match(/https?:\/\/[^\x00-\x20"']+/);
    return m ? m[0] : "";
}

async function rrCall(path, params) {
    try {
        const ts = Date.now();
        const dev = hexenc(Array.from({length: 16}, () => Math.floor(Math.random() * 256)));
        const keys = Object.keys(params).sort();
        const qs = keys.map(k => k + "=" + params[k]).join("&");
        const s = "GET\naliId:" + dev + "\nct:web_applet\ncv:1.0.0\nt:" + ts + "\n" + path + "?" + qs;
        const sg = b64enc(hmacSha256(RR_SS, utf8enc(s)));
        const r = await req(RR_API + path + "?" + qs, {
            headers: {
                "x-ca-sign": sg, "t": String(ts), "aliId": dev, "umid": dev, "deviceId": dev,
                "clientVersion": "1.0.0", "cv": "1.0.0", "clientType": "web_applet", "ct": "web_applet",
                "uet": "9", "User-Agent": RR_UA, "Origin": RR_REF.slice(0, -1), "Referer": RR_REF
            }, timeout: 20
        });
        const body = (r && r.content) || "";
        try {
            const dec = aesEcbDec(RR_DK, b64dec(body));
            return JSON.parse(utf8dec(dec));
        } catch (e) {
            return JSON.parse(body);
        }
    } catch (e) { return {}; }
}

async function rrspPlay(pu) {
    try {
        const dm = String(pu).match(/\/drama\/(\d+)/);
        if (!dm) return "";
        const did = dm[1];
        const em = String(pu).match(/episodeNo=(\d+)/);
        const eno = em ? parseInt(em[1], 10) : 1;
        const pg = await rrCall("/m-station/drama/page", { hsdrOpen: 0, isAgeLimit: 0, dramaId: did, pageNum: 1, pageSize: 200 });
        const eps = ((pg.data || {}).episodeList) || [];
        let sid = "";
        for (const e of eps) {
            if (parseInt(e.episodeNo || 0, 10) === eno) { sid = e.sid; break; }
        }
        if (!sid && eps.length) sid = eps[0].sid;
        if (!sid) return "";
        let last = "";
        for (let i = 0; i < 8; i++) {
            for (const q of ["HD", "SD"]) {
                const pl = await rrCall("/m-station/drama/play", { hsdrOpen: 0, dramaId: did, episodeSid: sid, quality: q, hevcOpen: 0, tria4k: 0 });
                const pd = pl.data || {};
                const m3 = pd.m3u8 || {};
                const ns = pd.newSign || "";
                if (!m3.url || ns.length < 20) continue;
                const dec = aesCbcDec(utf8enc(ns.substring(4, 20)), RR_IV, b64dec(m3.url));
                const u = utf8dec(dec);
                if (u.indexOf("auth_key=") >= 0) return u;
                last = u;
            }
        }
        return last;
    } catch (e) { return ""; }
}

async function play(flag, id, vipFlags) {
    const hdr = { "User-Agent": UA };
    try {
        let b64 = String(id);
        while (b64.length % 4) b64 += "=";
        const j = JSON.parse(utf8dec(b64dec(b64)));
        const pf = j.f || "", pu = j.u || "";
        if (pf === "RRSP" || pu.indexOf("yichengwlkj.com") >= 0) {
            const u = await rrspPlay(pu);
            if (u) return JSON.stringify({ parse: 0, url: u, header: { "User-Agent": RR_UA, "Referer": RR_REF } });
            return JSON.stringify({ parse: 0, url: "", header: hdr });
        }
        let url = await vuuGet(pf, pu);
        if (!url) url = pu;
        if (url.indexOf("http") !== 0) return JSON.stringify({ parse: 0, url: "", header: hdr });
        if (url.indexOf("response-content-disposition") >= 0 || url.indexOf(".mp4?") >= 0) {
            return JSON.stringify({ parse: 0, url: url, header: hdr });
        }
        if (/\.(m3u8|mp4|mkv|flv|ts|m4s)(\?|$)|\.mp4/.test(url)) {
            return JSON.stringify({ parse: 0, url: url, header: hdr });
        }
        if (/\/m3u8\/|\/hls\/|m3u8\?|\/api\/(banyun|gongyou)/.test(url)) {
            const sep = url.indexOf("?") >= 0 ? "&" : "?";
            return JSON.stringify({ parse: 0, url: url + sep + "ext=.m3u8", header: hdr });
        }
        return JSON.stringify({ parse: 1, url: url, header: hdr });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "", header: hdr });
    }
}

async function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    try {
        const vids = v5listOf(await postProto("/api/proto/v5/drama/search", { searchKeys: String(key), page: String(page), pagesize: "21" }));
        return JSON.stringify({ list: vids, page: page, pagecount: 9999, limit: 21, total: 999999 });
    } catch (e) {
        return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 21, total: 0 });
    }
}

export default { init, home, homeVod, category, detail, play, search };

export const getClientDeviceIp = (req:any)=>{
    const deviceIp = req.headers['x-forwarded-for']?.split(',')[0].trim();

    return deviceIp
}
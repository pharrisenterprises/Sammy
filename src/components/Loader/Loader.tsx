import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
const Loader = () => {
    return (
        <>
            <div className="flex flex-col justify-center items-center">
                <span className="loader relative object-cover p-2">
                    {/* <img src="logo/logo_white.svg" alt="img" className="w-40 mt-[25px]" /> */}
                </span>
                <Stack spacing={2} direction="row" alignItems="center" sx={{ mt: '30px' }}>
                    <CircularProgress size="5rem" />
                </Stack>
                <span className="text-[#000000] mt-[25px] text-xl font-light">Loading...</span>
            </div>
        </>
    );
};

export default Loader;

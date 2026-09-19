function signal_denoising_main()
%SIGNAL_DENOISING_MAIN 发布信号去噪代码案例。

    entryFile = [mfilename('fullpath'), '.m'];
    sourceDir = fileparts(entryFile);
    matlabDir = fileparts(fileparts(sourceDir));

    originalPath = path;
    addpath(sourceDir, matlabDir);
    pathCleanup = onCleanup(@() path(originalPath));

    publish_project(signal_denoising_config());
end

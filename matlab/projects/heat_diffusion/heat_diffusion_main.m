function heat_diffusion_main()
%HEAT_DIFFUSION_MAIN 发布二维热扩散代码案例。

    thisFile = [mfilename('fullpath'), '.m'];
    sourceDir = fileparts(thisFile);
    matlabDir = fileparts(fileparts(sourceDir));
    originalPath = path;
    pathCleanup = onCleanup(@() path(originalPath));
    addpath(matlabDir, '-begin');
    addpath(sourceDir, '-begin');
    publish_project(heat_diffusion_config());
end

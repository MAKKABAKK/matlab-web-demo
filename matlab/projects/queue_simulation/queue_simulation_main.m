function queue_simulation_main()
%QUEUE_SIMULATION_MAIN 发布单服务台排队仿真代码案例。

    thisFile = [mfilename('fullpath'), '.m'];
    sourceDir = fileparts(thisFile);
    matlabDir = fileparts(fileparts(sourceDir));
    originalPath = path;
    pathCleanup = onCleanup(@() path(originalPath));
    addpath(matlabDir, '-begin');
    addpath(sourceDir, '-begin');
    publish_project(queue_simulation_config());
end

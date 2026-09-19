function run_all()
%RUN_ALL 依序发布仓库中的所有 MATLAB 代码案例。

    thisFile = [mfilename('fullpath'), '.m'];
    matlabDir = fileparts(thisFile);
    projectRoot = fullfile(matlabDir, 'projects');
    projectDirs = { ...
        fullfile(projectRoot, 'signal_denoising'), ...
        fullfile(projectRoot, 'queue_simulation'), ...
        fullfile(projectRoot, 'heat_diffusion')};

    originalPath = path;
    pathCleanup = onCleanup(@() path(originalPath));
    addpath(matlabDir, '-begin');
    for index = 1:numel(projectDirs)
        if ~exist(projectDirs{index}, 'dir')
            error('Demo:ProjectDirectoryMissing', ...
                'Project directory not found: %s', projectDirs{index});
        end
        addpath(projectDirs{index}, '-begin');
    end

    fprintf('Publishing all MATLAB code cases...\n');
    main();
    signal_denoising_main();
    queue_simulation_main();
    heat_diffusion_main();
    fprintf('All MATLAB code cases finished.\n');
end

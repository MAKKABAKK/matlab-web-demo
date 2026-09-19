function validate_all()
%VALIDATE_ALL 执行全部 MATLAB 发布与产物验证，不依赖测试框架。

    testFile = [mfilename('fullpath'), '.m'];
    matlabDir = fileparts(fileparts(testFile));
    repositoryRoot = fileparts(matlabDir);
    projectSourceRoot = fullfile(matlabDir, 'projects');
    projectIds = {'passenger-flow', 'signal-denoising', ...
        'queue-simulation', 'heat-diffusion'};

    originalPath = path;
    originalDirectory = pwd;
    externalDirectory = tempname;
    mkdir(externalDirectory);
    cleanup = onCleanup(@() restoreEnvironment( ...
        originalPath, originalDirectory, externalDirectory));

    addpath(matlabDir, '-begin');
    addpath(fullfile(projectSourceRoot, 'signal_denoising'), '-begin');
    addpath(fullfile(projectSourceRoot, 'queue_simulation'), '-begin');
    addpath(fullfile(projectSourceRoot, 'heat_diffusion'), '-begin');

    % 从仓库外执行两次，验证路径独立性与固定随机种子的可重现性。
    cd(externalDirectory);
    run_all();
    firstResults = readAllResults(projectIds);
    run_all();
    secondResults = readAllResults(projectIds);
    for index = 1:numel(projectIds)
        assert(isequaln(removePublishTime(firstResults{index}), ...
            removePublishTime(secondResults{index})), ...
            'Demo:NonDeterministicResult', ...
            'Project %s produced different results across runs.', projectIds{index});
    end

    catalogPath = fullfile(repositoryRoot, 'docs', 'content', 'catalog.json');
    catalog = jsondecode(fileread(catalogPath));
    for index = 1:numel(projectIds)
        validatePublishedProject(projectIds{index}, catalog, matlabDir);
    end
    validateDomainResults(secondResults);
    validateSourceQuality(matlabDir);
    validateBaseMatlabOnly(matlabDir);
    fprintf('MATLAB validation passed: %d projects\n', numel(projectIds));
end

function results = readAllResults(projectIds)
%READALLRESULTS 读取全部已发布结果。
    results = cell(1, numel(projectIds));
    for index = 1:numel(projectIds)
        paths = demo_project_paths(projectIds{index});
        resultPath = fullfile(paths.dataDir, 'results.json');
        assert(exist(resultPath, 'file') == 2, ...
            'Demo:MissingResult', 'Missing result file: %s', resultPath);
        results{index} = jsondecode(fileread(resultPath));
    end
end

function value = removePublishTime(value)
%REMOVEPUBLISHTIME 排除每次发布都会变化的时间字段。
    if isfield(value, 'lastUpdated')
        value = rmfield(value, 'lastUpdated');
    end
end

function validatePublishedProject(projectId, catalog, matlabDir)
%VALIDATEPUBLISHEDPROJECT 检查 JSON、PNG、源码副本与元数据。
    paths = demo_project_paths(projectId);
    manifest = jsondecode(fileread(paths.manifestPath));
    catalogProject = findCatalogProject(catalog.categories, projectId);
    assert(strcmp(manifest.id, projectId), 'Demo:ManifestMismatch', ...
        'Manifest ID mismatch for %s.', projectId);
    assert(strcmp(manifest.lastUpdated, catalogProject.lastUpdated), ...
        'Demo:TimestampMismatch', 'Catalog timestamp mismatch for %s.', projectId);
    assert(~isempty(manifest.version), 'Demo:MissingVersion', ...
        'Manifest version is empty for %s.', projectId);

    sourceDirectory = sourceDirectoryFor(projectId, matlabDir);
    for index = 1:collectionLength(manifest.artifacts)
        artifact = collectionItem(manifest.artifacts, index);
        artifactPath = fullfile(paths.projectContentDir, artifact.file);
        assert(exist(artifactPath, 'file') == 2, ...
            'Demo:MissingArtifact', 'Missing artifact: %s', artifactPath);
        info = dir(artifactPath);
        assert(info.bytes > 0, 'Demo:EmptyArtifact', ...
            'Artifact is empty: %s', artifactPath);

        if strcmp(artifact.kind, 'plot')
            imageInfo = imfinfo(artifactPath);
            assert(imageInfo.Width >= 300 && imageInfo.Height >= 200, ...
                'Demo:SmallPlot', 'Plot is unexpectedly small: %s', artifactPath);
        elseif strcmp(artifact.kind, 'json')
            jsondecode(fileread(artifactPath));
        elseif strcmp(artifact.kind, 'matlab-code')
            [~, sourceName, sourceExtension] = fileparts(artifact.file);
            sourcePath = fullfile(sourceDirectory, [sourceName, sourceExtension]);
            assert(exist(sourcePath, 'file') == 2, ...
                'Demo:MissingSource', 'Published source has no original: %s', sourcePath);
            assert(strcmp(fileread(sourcePath), fileread(artifactPath)), ...
                'Demo:SourceCopyMismatch', 'Published source differs: %s', artifactPath);
        end
    end
end

function directory = sourceDirectoryFor(projectId, matlabDir)
%SOURCEDIRECTORYFOR 找出项目原始码目录。
    if strcmp(projectId, 'passenger-flow')
        directory = matlabDir;
    else
        directory = fullfile(matlabDir, 'projects', strrep(projectId, '-', '_'));
    end
end

function match = findCatalogProject(categories, projectId)
%FINDCATALOGPROJECT 在分类树中寻找独立案例。
    for categoryIndex = 1:collectionLength(categories)
        category = collectionItem(categories, categoryIndex);
        for projectIndex = 1:collectionLength(category.projects)
            project = collectionItem(category.projects, projectIndex);
            if strcmp(project.id, projectId)
                match = project;
                return;
            end
        end
    end
    error('Demo:ProjectNotFound', 'Project not found: %s', projectId);
end

function count = collectionLength(collection)
%COLLECTIONLENGTH 返回 JSON 阵列元素数量。
    count = numel(collection);
end

function item = collectionItem(collection, index)
%COLLECTIONITEM 读取 JSON 阵列元素。
    if iscell(collection)
        item = collection{index};
    else
        item = collection(index);
    end
end

function validateDomainResults(results)
%VALIDATEDOMAINRESULTS 检查四个案例的关键领域不变量。
    passenger = results{1};
    assert(passenger.metrics.RMSE >= passenger.metrics.MAE && ...
        passenger.metrics.MAE >= 0, 'Demo:InvalidForecastMetrics');
    assert(passenger.metrics.R2 <= 1, 'Demo:InvalidForecastR2');
    modelScores = [passenger.models.rmse];
    assert(min(modelScores) >= 0, 'Demo:InvalidModelScores');

    signal = results{2};
    assert(signal.metrics.outputSNR > signal.metrics.inputSNR, ...
        'Demo:SignalDidNotImprove');
    assert(signal.metrics.filteredRMSE < signal.metrics.rawRMSE, ...
        'Demo:SignalErrorDidNotImprove');

    queue = results{3};
    assert(queue.metrics.meanWait >= 0 && ...
        queue.metrics.p95Wait >= queue.metrics.meanWait, ...
        'Demo:InvalidQueueWait');
    assert(queue.metrics.utilization >= 0 && queue.metrics.utilization <= 1, ...
        'Demo:InvalidQueueUtilization');
    assert(queue.metrics.maxQueue >= 0 && fix(queue.metrics.maxQueue) == ...
        queue.metrics.maxQueue, 'Demo:InvalidQueueLength');

    heat = results{4};
    assert(heat.metrics.finalPeak < heat.metrics.initialPeak, ...
        'Demo:HeatDidNotCool');
    assert(heat.metrics.stabilityRatio > 0 && ...
        heat.metrics.stabilityRatio <= 0.25, 'Demo:InvalidHeatRatio');
    assert(heat.metrics.energyRetainedPercent >= 0 && ...
        heat.metrics.energyRetainedPercent <= 100, ...
        'Demo:InvalidHeatEnergy');
end

function validateSourceQuality(matlabDir)
%VALIDATESOURCEQUALITY 以 checkcode 检查所有原始 MATLAB 文件。
    sourceFiles = dir(fullfile(matlabDir, '**', '*.m'));
    for index = 1:numel(sourceFiles)
        filePath = fullfile(sourceFiles(index).folder, sourceFiles(index).name);
        messages = checkcode(filePath, '-id');
        if ~isempty(messages)
            error('Demo:CheckcodeFailed', ...
                'MATLAB checkcode failed at %s:%d: %s', ...
                filePath, messages(1).line, messages(1).message);
        end
    end
end

function validateBaseMatlabOnly(matlabDir)
%VALIDATEBASEMATLABONLY 确认入口不依赖额外工具箱。
    entries = { ...
        fullfile(matlabDir, 'main.m'), ...
        fullfile(matlabDir, 'projects', 'signal_denoising', 'signal_denoising_main.m'), ...
        fullfile(matlabDir, 'projects', 'queue_simulation', 'queue_simulation_main.m'), ...
        fullfile(matlabDir, 'projects', 'heat_diffusion', 'heat_diffusion_main.m')};
    for index = 1:numel(entries)
        [~, products] = matlab.codetools.requiredFilesAndProducts(entries{index});
        productNames = {products.Name};
        extraProducts = productNames(~strcmp(productNames, 'MATLAB'));
        assert(isempty(extraProducts), 'Demo:UnexpectedToolbox', ...
            'Unexpected toolbox for %s: %s', entries{index}, strjoin(extraProducts, ', '));
    end
end

function restoreEnvironment(originalPath, originalDirectory, temporaryDirectory)
%RESTOREENVIRONMENT 还原路径、工作目录并删除专用临时目录。
    path(originalPath);
    if exist(originalDirectory, 'dir')
        cd(originalDirectory);
    end
    if exist(temporaryDirectory, 'dir')
        rmdir(temporaryDirectory, 's');
    end
end

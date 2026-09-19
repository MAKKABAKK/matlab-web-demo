function simulation = simulate_queue_demo(numCustomers, arrivalRate, serviceRate, seed)
%SIMULATE_QUEUE_DEMO 使用逆变换法模拟 FIFO 单服务台队列。

    if numCustomers < 2 || arrivalRate <= 0 || serviceRate <= 0
        error('Demo:InvalidQueueParameters', 'Queue parameters must be positive.');
    end
    if arrivalRate >= serviceRate
        error('Demo:UnstableQueue', 'Arrival rate must be below service rate.');
    end

    rng(seed, 'twister');
    interarrival = -log(max(rand(numCustomers, 1), realmin)) / arrivalRate;
    service = -log(max(rand(numCustomers, 1), realmin)) / serviceRate;
    arrival = cumsum(interarrival);
    serviceStart = zeros(numCustomers, 1);
    departure = zeros(numCustomers, 1);
    queueAtArrival = zeros(numCustomers, 1);

    serviceStart(1) = arrival(1);
    departure(1) = serviceStart(1) + service(1);
    for customer = 2:numCustomers
        serviceStart(customer) = max(arrival(customer), departure(customer - 1));
        departure(customer) = serviceStart(customer) + service(customer);
        % 到达瞬间尚未离开的旧客户数，等于新客户前方的排队人数。
        queueAtArrival(customer) = sum(departure(1:customer - 1) > arrival(customer));
    end

    waiting = serviceStart - arrival;
    elapsed = departure(end) - arrival(1);
    utilization = sum(service) / elapsed;
    simulation = struct( ...
        'arrivalRate', arrivalRate, ...
        'serviceRate', serviceRate, ...
        'arrival', arrival, ...
        'service', service, ...
        'serviceStart', serviceStart, ...
        'departure', departure, ...
        'waiting', waiting, ...
        'queueAtArrival', queueAtArrival, ...
        'utilization', utilization);
end

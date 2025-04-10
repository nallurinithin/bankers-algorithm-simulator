// Global variables
let processes = 0;
let resources = 0;
let totalResources = [];
let available = [];
let maximum = [];
let allocation = [];
let need = [];
let totalAllocated = [];
let safetySequence = [];
let allSafeSequences = []; // Store all possible safe sequences
let currentProcess = 0; // Current process being configured
let needConfirmed = false; // Whether the current process need is confirmed
let animationSpeed = 1200; // Animation speed in milliseconds (slowed down)
let debugMode = false; // Debug mode flag

// Statistics
let statistics = {
    requestsGranted: 0,
    requestsDenied: 0,
    resourcesReleased: 0,
    deadlocksAvoided: 0
};

// Tutorial functions
function showTutorial() {
    document.getElementById('tutorialModal').classList.remove('hidden');
}

function closeTutorial() {
    document.getElementById('tutorialModal').classList.add('hidden');
}

// Sample scenarios
const sampleScenarios = {
    simple: {
        name: "Simple Example",
        processes: 3,
        resources: 2,
        totalResources: [10, 8],
        available: [3, 2],
        allocation: [
            [2, 1],
            [3, 3],
            [2, 2]
        ],
        maximum: [
            [4, 3],
            [6, 4],
            [4, 4]
        ]
    },
    deadlock: {
        name: "Deadlock Risk",
        processes: 4,
        resources: 3,
        totalResources: [12, 10, 8],
        available: [2, 1, 0],
        allocation: [
            [3, 2, 2],
            [2, 3, 2],
            [3, 2, 3],
            [2, 2, 1]
        ],
        maximum: [
            [5, 4, 4],
            [4, 5, 4],
            [5, 4, 5],
            [4, 4, 3]
        ]
    }
};

function loadScenario(scenarioName) {
    const scenario = sampleScenarios[scenarioName];
    if (!scenario) return;

    // Reset and set up new scenario
    resetSimulator();
    
    processes = scenario.processes;
    resources = scenario.resources;
    document.getElementById('processes').value = processes;
    document.getElementById('resources').value = resources;
    
    // Set up resources
    document.getElementById('totalResources').value = scenario.totalResources.join(', ');
    document.getElementById('available').value = scenario.available.join(', ');
    
    // Initialize arrays
    allocation = scenario.allocation.map(row => [...row]);
    maximum = scenario.maximum.map(row => [...row]);
    need = maximum.map((row, i) => 
        row.map((max, j) => max - allocation[i][j])
    );
    totalAllocated = Array(resources).fill(0);
    available = [...scenario.available];
    totalResources = [...scenario.totalResources];
    
    // Calculate total allocated
    for (let i = 0; i < processes; i++) {
        for (let j = 0; j < resources; j++) {
            totalAllocated[j] += allocation[i][j];
        }
    }
    
    // Show process input and visualization
    document.getElementById('initialSetup').classList.add('hidden');
    document.getElementById('resourceSetup').classList.add('hidden');
    document.getElementById('processInput').classList.remove('hidden');
    document.getElementById('visualization').classList.remove('hidden');
    document.getElementById('requestSimulation').classList.remove('hidden');
    document.getElementById('resourceRelease').classList.remove('hidden');
    document.getElementById('statisticsPanel').classList.remove('hidden');
    
    // Update displays
    currentProcess = 0;
    needConfirmed = true;
    updateProcessMatrix();
    updateResourcesDisplay();
    showProcessInputs();
    updateStatisticsDisplay();
    
    // Run safety check
    runSafetyAlgorithm();
}

// Resource Request Simulation
function simulateResourceRequest() {
    const requestingProcess = parseInt(document.getElementById('requestProcess').value);
    const request = validateInput(document.getElementById('requestResources').value, "Request");
    
    if (request === null) {
        return;
    }
    
    if (isNaN(requestingProcess) || requestingProcess < 0 || requestingProcess >= processes) {
        showError('Please select a valid process');
        return;
    }
    
    if (request.length !== resources) {
        showError(`Please enter exactly ${resources} values for the request (one for each resource type)`);
        return;
    }
    
    // Save original values for comparison
    const originalAllocation = allocation.map(row => [...row]);
    const originalNeed = need.map(row => [...row]);
    const originalAvailable = [...available];
    
    // STEP 1: Check if request <= Need
    let needExceeded = false;
    
    for (let i = 0; i < resources; i++) {
        if (request[i] > need[requestingProcess][i]) {
            needExceeded = true;
            break;
        }
    }
    
    if (needExceeded) {
        // Show detailed error with guidance
        const errorMessage = `
            <div class="text-red-700">
                <p><strong>Request denied:</strong> Process P${requestingProcess} is requesting more resources than it needs.</p>
                <p class="mt-2">Request: [${request.join(', ')}]</p>
                <p>Current need: [${need[requestingProcess].join(', ')}]</p>
                <p class="mt-2"><strong>Hint:</strong> A process cannot request more resources than it has declared in its maximum need.</p>
            </div>
        `;
        
        // Create and show the detailed error in the request area
        const requestDiv = document.getElementById('requestSimulation');
        const oldSummary = document.getElementById('changeSummary');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'changeSummary';
        errorDiv.className = 'bg-red-50 p-4 rounded-lg mb-4 border border-red-200';
        errorDiv.innerHTML = errorMessage;
        
        requestDiv.insertBefore(errorDiv, requestDiv.firstChild.nextSibling);
        requestDiv.scrollIntoView({ behavior: 'smooth' });
        
        showError(`Request denied: Process P${requestingProcess} is requesting more than its need.`);
        
        // Update statistics for denied request
        updateStatistics('request', false);
        return;
    }
    
    // STEP 2: Check if request <= Available
    let resourcesUnavailable = false;
    let insufficientResources = [];
    
    for (let i = 0; i < resources; i++) {
        if (request[i] > available[i]) {
            resourcesUnavailable = true;
            insufficientResources.push(`R${i}: requested ${request[i]}, only ${available[i]} available`);
        }
    }
    
    if (resourcesUnavailable) {
        // Show detailed error with guidance
        const errorMessage = `
            <div class="text-red-700">
                <p><strong>Request denied:</strong> Not enough resources available.</p>
                <p class="mt-2">Request: [${request.join(', ')}]</p>
                <p>Available resources: [${available.join(', ')}]</p>
                <p class="mt-2"><strong>Hint:</strong> The banker cannot allocate resources it does not have available.</p>
                <p class="mt-2">The following resources are insufficient:</p>
                <ul class="list-disc pl-5">
                    ${insufficientResources.map(res => `<li>${res}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Create and show the detailed error
        const requestDiv = document.getElementById('requestSimulation');
        const oldSummary = document.getElementById('changeSummary');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'changeSummary';
        errorDiv.className = 'bg-red-50 p-4 rounded-lg mb-4 border border-red-200';
        errorDiv.innerHTML = errorMessage;
        
        requestDiv.insertBefore(errorDiv, requestDiv.firstChild.nextSibling);
        requestDiv.scrollIntoView({ behavior: 'smooth' });
        
        showError(`Request denied: Insufficient resources available.`);
        
        // Update statistics for denied request
        updateStatistics('request', false);
        return;
    }
    
    // STEP 3: Try allocation (simulate)
    // Create temporary copies of allocation, available, need matrices
    const tempAllocation = allocation.map(row => [...row]);
    const tempAvailable = [...available];
    const tempNeed = need.map(row => [...row]);
    
    // Pretend to allocate resources
    for (let i = 0; i < resources; i++) {
        tempAllocation[requestingProcess][i] += request[i];
        tempAvailable[i] -= request[i];
        tempNeed[requestingProcess][i] -= request[i];
    }
    
    // STEP 4: Check if the resulting state is safe
    const isSafe = checkSafeState(tempAllocation, tempAvailable);
    
    if (isSafe) {
        // STEP 5: If safe, actually perform the allocation
        allocation = tempAllocation;
        available = tempAvailable;
        need = tempNeed;
        
        // Update total allocated
        for (let i = 0; i < resources; i++) {
            totalAllocated[i] += request[i];
        }
        
        // Create a visual change summary
        const changesSummary = `
        <div class="bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
            <h4 class="font-medium text-green-800 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                Resource Request Granted
            </h4>
            <p class="text-sm mb-3">Process P${requestingProcess} requested: [${request.join(', ')}]</p>
            
            <div class="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div class="bg-white p-3 rounded border border-gray-200">
                    <div class="font-medium text-gray-700 mb-1">Before Request:</div>
                    <div class="space-y-1">
                        <div>Allocation P${requestingProcess}: [${originalAllocation[requestingProcess].join(', ')}]</div>
                        <div>Need P${requestingProcess}: [${originalNeed[requestingProcess].join(', ')}]</div>
                        <div>Available: [${originalAvailable.join(', ')}]</div>
                    </div>
                </div>
                
                <div class="bg-white p-3 rounded border border-green-200">
                    <div class="font-medium text-green-700 mb-1">After Request:</div>
                    <div class="space-y-1">
                        <div>Allocation P${requestingProcess}: [${allocation[requestingProcess].join(', ')}]</div>
                        <div>Need P${requestingProcess}: [${need[requestingProcess].join(', ')}]</div>
                        <div>Available: [${available.join(', ')}]</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-3 text-sm text-green-700 bg-green-50 p-2 rounded">
                <p><strong>The banker has granted this request because:</strong></p>
                <ul class="list-disc pl-5 mt-1">
                    <li>The request is within the process's maximum need</li>
                    <li>There are enough available resources</li>
                    <li>The resulting state is safe (will not lead to deadlock)</li>
                </ul>
            </div>
        </div>
        `;
        
        // Insert changes summary at the top of requestSimulation div
        const requestDiv = document.getElementById('requestSimulation');
        const oldSummary = document.getElementById('changeSummary');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'changeSummary';
        summaryDiv.innerHTML = changesSummary;
        requestDiv.insertBefore(summaryDiv, requestDiv.firstChild.nextSibling);
        
        // Highlight the changed row in the process matrix
        updateProcessMatrix(requestingProcess);
        updateResourcesDisplay(true);
        runSafetyAlgorithm();
        updateStatistics('request', true);
        
        // Scroll to the changes
        requestDiv.scrollIntoView({ behavior: 'smooth' });
        
        showSuccess(`Request granted for Process P${requestingProcess}. The system remains in a safe state.`);
    } else {
        // Show detailed error with guidance for unsafe state
        const errorMessage = `
            <div class="text-red-700">
                <p><strong>Request denied:</strong> Would lead to an unsafe state.</p>
                <p class="mt-2">Request: [${request.join(', ')}]</p>
                <div class="mt-3 bg-red-50 p-3 rounded">
                    <p><strong>Why this request is unsafe:</strong></p>
                    <p class="mt-1">If this request were granted, the system could reach a deadlock.</p>
                    <p class="mt-2">Even though resources are available now, the request would leave the system in a state where no process can complete its execution.</p>
                    <p class="mt-2"><strong>Hint:</strong> Try one of these approaches:</p>
                    <ul class="list-disc pl-5 mt-1">
                        <li>Request fewer resources at this time</li>
                        <li>Try releasing some resources from other processes first</li>
                        <li>Request resources in a different order</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Create and show the detailed error in the request area
        const requestDiv = document.getElementById('requestSimulation');
        const oldSummary = document.getElementById('changeSummary');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'changeSummary';
        errorDiv.className = 'bg-red-50 p-4 rounded-lg mb-4 border border-red-200';
        errorDiv.innerHTML = errorMessage;
        
        requestDiv.insertBefore(errorDiv, requestDiv.firstChild.nextSibling);
        requestDiv.scrollIntoView({ behavior: 'smooth' });
        
        showError(`Request denied: Would lead to unsafe state. Allocation would risk deadlock.`);
        updateStatistics('request', false);
        statistics.deadlocksAvoided++;
        updateStatisticsDisplay();
    }
}

// Function to check if a state is safe (for resource request simulation)
function checkSafeState(testAllocation, testAvailable) {
    // Create temporary copies for the safety check
    let work = [...testAvailable];
    let finish = Array(processes).fill(false);
    let tempNeed = [];
    
    // Calculate need matrix based on test allocation
    for (let i = 0; i < processes; i++) {
        tempNeed[i] = maximum[i].map((max, j) => max - testAllocation[i][j]);
    }
    
    // Run the safety algorithm
    let found;
    do {
        found = false;
        for (let i = 0; i < processes; i++) {
            if (!finish[i]) {
                // Check if this process can finish with current work
                let canComplete = true;
                for (let j = 0; j < resources; j++) {
                    if (tempNeed[i][j] > work[j]) {
                        canComplete = false;
                        break;
                    }
                }
                
                // If process can complete
                if (canComplete) {
                    // Mark as finished and release its resources
                    finish[i] = true;
                    for (let j = 0; j < resources; j++) {
                        work[j] += testAllocation[i][j];
                    }
                    found = true;
                }
            }
        }
    } while (found);
    
    // If all processes are finished, the state is safe
    return finish.every(f => f);
}

// Function to release resources with better visualization and feedback
function releaseResources() {
    const releasingProcess = parseInt(document.getElementById('releaseProcess').value);
    const release = validateInput(document.getElementById('releaseResources').value, "Release");
    
    if (release === null) {
        return;
    }
    
    if (isNaN(releasingProcess) || releasingProcess < 0 || releasingProcess >= processes) {
        showError('Please select a valid process');
        return;
    }
    
    if (release.length !== resources) {
        showError(`Please enter exactly ${resources} values for resource release`);
        return;
    }
    
    // Save original values for comparison
    const originalAllocation = allocation.map(row => [...row]);
    const originalNeed = need.map(row => [...row]);
    const originalAvailable = [...available];
    
    // Check if release <= Allocation
    let invalidRelease = false;
    const excessResources = [];
    
    for (let i = 0; i < resources; i++) {
        if (release[i] > allocation[releasingProcess][i]) {
            invalidRelease = true;
            excessResources.push(i);
        }
    }
    
    if (invalidRelease) {
        // Show detailed error with guidance
        const errorMessage = `
            <div class="text-red-700">
                <p><strong>Release denied:</strong> Process P${releasingProcess} is trying to release more resources than it has.</p>
                <p class="mt-2">Release request: [${release.join(', ')}]</p>
                <p>Current allocation: [${allocation[releasingProcess].join(', ')}]</p>
                <p class="mt-2">The following resources exceed current allocation:</p>
                <ul class="list-disc pl-5">
                    ${excessResources.map(r => `<li>Resource ${r}: Trying to release ${release[r]}, but only has ${allocation[releasingProcess][r]}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Create and show the detailed error
        const releaseDiv = document.getElementById('resourceRelease');
        const oldSummary = document.getElementById('releaseSummary');
        if (oldSummary) {
            oldSummary.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'releaseSummary';
        errorDiv.className = 'bg-red-50 p-4 rounded-lg mb-4 border border-red-200';
        errorDiv.innerHTML = errorMessage;
        
        releaseDiv.insertBefore(errorDiv, releaseDiv.firstChild.nextSibling);
        releaseDiv.scrollIntoView({ behavior: 'smooth' });
        
        showError(`Release denied: Process is trying to release more resources than it has.`);
        return;
    }
    
    // Perform the release
    for (let i = 0; i < resources; i++) {
        allocation[releasingProcess][i] -= release[i];
        available[i] += release[i];
        need[releasingProcess][i] += release[i];
        totalAllocated[i] -= release[i];
    }
    
    // Create a visual change summary
    const changesSummary = `
        <div class="bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
            <h4 class="font-medium text-green-800 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                Resources Released Successfully
            </h4>
            <p class="text-sm mb-3">Process P${releasingProcess} released: [${release.join(', ')}]</p>
            
            <div class="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div class="bg-white p-3 rounded border border-gray-200">
                    <div class="font-medium text-gray-700 mb-1">Before Release:</div>
                    <div class="space-y-1">
                        <div>Allocation P${releasingProcess}: [${originalAllocation[releasingProcess].join(', ')}]</div>
                        <div>Need P${releasingProcess}: [${originalNeed[releasingProcess].join(', ')}]</div>
                        <div>Available: [${originalAvailable.join(', ')}]</div>
                    </div>
                </div>
                <div class="bg-white p-3 rounded border border-gray-200">
                    <div class="font-medium text-gray-700 mb-1">After Release:</div>
                    <div class="space-y-1">
                        <div>Allocation P${releasingProcess}: [${allocation[releasingProcess].join(', ')}]</div>
                        <div>Need P${releasingProcess}: [${need[releasingProcess].join(', ')}]</div>
                        <div>Available: [${available.join(', ')}]</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-3 text-sm text-green-700 bg-green-50 p-2 rounded">
                <p><strong>Effects of this release:</strong></p>
                <ul class="list-disc pl-5 mt-1">
                    <li>More resources are now available for other processes</li>
                    <li>The system remains in a safe state</li>
                    <li>Process P${releasingProcess} can now request these resources again if needed</li>
                </ul>
            </div>
        </div>
    `;
    
    // Insert changes summary at the top of resourceRelease div
    const releaseDiv = document.getElementById('resourceRelease');
    const oldSummary = document.getElementById('releaseSummary');
    if (oldSummary) {
        oldSummary.remove();
    }
    
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'releaseSummary';
    summaryDiv.innerHTML = changesSummary;
    releaseDiv.insertBefore(summaryDiv, releaseDiv.firstChild.nextSibling);
    
    // Update visualizations
    updateProcessMatrix(releasingProcess);
    updateResourcesDisplay(true);
    runSafetyAlgorithm();
    
    // Show success message and update statistics
    showSuccess(`Resources released by process P${releasingProcess}`);
    updateStatistics('release');
}

// Modified to highlight the recently changed row
function updateProcessMatrix(highlightRow = null) {
    const tbody = document.getElementById('processTableBody');
    tbody.innerHTML = '';

    for (let i = 0; i < processes; i++) {
        const row = document.createElement('tr');
        if (highlightRow === i) {
            row.className = 'bg-yellow-100 transition-colors duration-1000';
            // Remove highlight after 2 seconds
            setTimeout(() => {
                if (row.parentNode) {
                    row.className = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                }
            }, 2000);
        } else {
            row.className = i === currentProcess ? 'bg-indigo-50' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50');
        }

        // Process ID
        const processCell = document.createElement('td');
        processCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
        processCell.textContent = `P${i}`;
        row.appendChild(processCell);

        // Allocation
        const allocationCell = document.createElement('td');
        allocationCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        allocationCell.textContent = allocation[i] ? `[${allocation[i].join(', ')}]` : '...';
        row.appendChild(allocationCell);

        // Maximum
        const maxCell = document.createElement('td');
        maxCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        maxCell.textContent = maximum[i] ? `[${maximum[i].join(', ')}]` : '...';
        row.appendChild(maxCell);

        // Need
        const needCell = document.createElement('td');
        needCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        needCell.textContent = need[i] ? `[${need[i].join(', ')}]` : '...';
        row.appendChild(needCell);

        tbody.appendChild(row);
    }
}

// Modified to highlight changes in resources
function updateResourcesDisplay(highlight = false) {
    const totalDiv = document.getElementById('totalResourcesValue');
    const availableDiv = document.getElementById('availableResourcesValue');
    const allocatedDiv = document.getElementById('totalAllocatedValue');
    
    totalDiv.textContent = totalResources.length > 0 ? `[${totalResources.join(', ')}]` : '...';
    
    availableDiv.textContent = available.length > 0 ? `[${available.join(', ')}]` : '...';
    if (highlight) {
        availableDiv.classList.add('highlight-change');
        setTimeout(() => availableDiv.classList.remove('highlight-change'), 2000);
    }
    
    allocatedDiv.textContent = totalAllocated.length > 0 ? `[${totalAllocated.join(', ')}]` : '...';
    if (highlight) {
        allocatedDiv.classList.add('highlight-change');
        setTimeout(() => allocatedDiv.classList.remove('highlight-change'), 2000);
    }
}

// Navigation functions
function showResourceSetup() {
    const processCount = parseInt(document.getElementById('processes').value);
    const resourceCount = parseInt(document.getElementById('resourceTypes').value);
    
    if (isNaN(processCount) || processCount <= 0) {
        showError('Please enter a valid number of processes');
        return;
    }
    
    if (isNaN(resourceCount) || resourceCount <= 0) {
        showError('Please enter a valid number of resource types');
        return;
    }
    
    if (processCount > 10 || resourceCount > 10) {
        showError('Maximum allowed value for processes and resources is 10');
        return;
    }
    
    // Store values
    processes = processCount;
    resources = resourceCount;
    
    // Update UI
    document.getElementById('initialSetup').classList.add('hidden');
    document.getElementById('resourceSetup').classList.remove('hidden');
}

function startInputProcess() {
    // Validate and get resource inputs
    const totalResourcesInput = validateInput(document.getElementById('totalResources').value, "Total Resources");
    const availableInput = validateInput(document.getElementById('available').value, "Available Resources");

    if (!totalResourcesInput || !availableInput) {
        return;
    }

    if (totalResourcesInput.length !== resources || availableInput.length !== resources) {
        showError(`Please enter exactly ${resources} values for each resource type`);
        return;
    }
    
    // Validate that available resources don't exceed total resources
    for (let i = 0; i < resources; i++) {
        if (availableInput[i] > totalResourcesInput[i]) {
            showError(`Available resources (${availableInput[i]}) cannot exceed total resources (${totalResourcesInput[i]}) for R${i}`);
            return;
        }
    }

    // Initialize arrays
    allocation = Array(processes).fill().map(() => Array(resources).fill(0));
    maximum = Array(processes).fill().map(() => Array(resources).fill(0));
    need = Array(processes).fill().map(() => Array(resources).fill(0));
    processState = Array(processes).fill(false);
    totalAllocated = Array(resources).fill(0);
    
    available = [...availableInput];
    totalResources = [...totalResourcesInput];

    // Hide resource setup and show process input
    document.getElementById('resourceSetup').classList.add('hidden');
    document.getElementById('processInput').classList.remove('hidden');
    document.getElementById('visualization').classList.remove('hidden');
    document.getElementById('requestSimulation').classList.remove('hidden');
    document.getElementById('resourceRelease').classList.remove('hidden');
    document.getElementById('statisticsPanel').classList.remove('hidden');
    
    // Update displays
    updateProcessMatrix();
    updateResourcesDisplay();
    updateStatisticsDisplay();
    
    // Start with first process
    currentProcess = 0;
    showProcessInputs();
}

function showProcessInputs() {
    document.getElementById('currentProcessLabel').textContent = `Process P${currentProcess}`;
    
    // Clear previous inputs
    document.getElementById('allocation').value = allocation[currentProcess] ? allocation[currentProcess].join(', ') : '';
    document.getElementById('maxNeed').value = maximum[currentProcess] ? maximum[currentProcess].join(', ') : '';
    
    if (allocation[currentProcess] && maximum[currentProcess]) {
        document.getElementById('calculatedNeed').innerHTML = `
            <div class="text-sm space-y-2">
                <div>Maximum Need: [${maximum[currentProcess].join(', ')}]</div>
                <div>Current Allocation: [${allocation[currentProcess].join(', ')}]</div>
                <div>Remaining Need: [${need[currentProcess].join(', ')}]</div>
            </div>
        `;
        needConfirmed = true;
    } else {
        document.getElementById('calculatedNeed').innerHTML = '';
        needConfirmed = false;
    }

    hideError();
    updateNavigationButtons();
}

function goBack() {
    if (currentProcess > 0) {
        currentProcess--;
        showProcessInputs();
        updateNavigationButtons();
    } else {
        // Go back to resource setup
        document.getElementById('processInput').classList.add('hidden');
        document.getElementById('resourceSetup').classList.remove('hidden');
    }
}

function goForward() {
    if (needConfirmed) {
        if (currentProcess < processes - 1) {
            currentProcess++;
            showProcessInputs();
            updateNavigationButtons();
            // Clear inputs for next process if not already set
            if (!allocation[currentProcess] || !maximum[currentProcess]) {
                document.getElementById('allocation').value = '';
                document.getElementById('maxNeed').value = '';
                document.getElementById('calculatedNeed').innerHTML = '';
                needConfirmed = false;
            }
        } else {
            // All processes entered, show safety check
            runSafetyAlgorithm();
        }
    } else {
        showError('Please confirm the current process values first');
    }
}

function updateNavigationButtons() {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Back button is enabled if we're not on the first process
    backBtn.disabled = currentProcess === 0;
    backBtn.classList.toggle('opacity-50', currentProcess === 0);
    
    // Next button is enabled if current need is confirmed
    nextBtn.disabled = !needConfirmed;
    nextBtn.classList.toggle('opacity-50', !needConfirmed);
}

function calculateNeed() {
    hideError();

    // Get and validate inputs
    const allocationValues = validateInput(document.getElementById('allocation').value, "Allocation");
    const maxValues = validateInput(document.getElementById('maxNeed').value, "Maximum Need");

    if (!allocationValues || !maxValues) {
        return false;
    }

    if (allocationValues.length !== resources || maxValues.length !== resources) {
        showError(`Please enter exactly ${resources} values for each resource type`);
        return false;
    }

    // Calculate what the total allocated would be with this new allocation
    const tempTotalAllocated = [...totalAllocated];
    
    // Subtract current process's previous allocation (if any)
    if (allocation[currentProcess]) {
        for (let i = 0; i < resources; i++) {
            tempTotalAllocated[i] -= allocation[currentProcess][i];
        }
    }
    
    // Add new allocation
    for (let i = 0; i < resources; i++) {
        tempTotalAllocated[i] += allocationValues[i];
    }

    // Validate allocation against total resources
    for (let r = 0; r < resources; r++) {
        if (tempTotalAllocated[r] > totalResources[r]) {
            showError(`Cannot allocate ${allocationValues[r]} units of R${r} - total allocated would exceed total resources (${totalResources[r]})`);
            return false;
        }
    }

    // Validate maximum need against total resources
    for (let r = 0; r < resources; r++) {
        if (maxValues[r] > totalResources[r]) {
            showError(`Maximum need (${maxValues[r]}) cannot exceed total resources (${totalResources[r]}) for R${r}`);
            return null;
        }
        if (maxValues[r] < allocationValues[r]) {
            showError(`Maximum need (${maxValues[r]}) cannot be less than current allocation (${allocationValues[r]}) for R${r}`);
            return null;
        }
    }

    // Update total allocated and available resources
    for (let r = 0; r < resources; r++) {
        // Remove previous allocation if it exists
        if (allocation[currentProcess]) {
            totalAllocated[r] -= allocation[currentProcess][r];
        }
        // Add new allocation
        totalAllocated[r] += allocationValues[r];
        // Update available resources
        available[r] = totalResources[r] - totalAllocated[r];
    }

    // Store values
    allocation[currentProcess] = [...allocationValues];
    maximum[currentProcess] = [...maxValues];
    need[currentProcess] = maxValues.map((max, i) => max - allocationValues[i]);

    // Display calculated need
    const needDisplay = document.getElementById('calculatedNeed');
    needDisplay.innerHTML = `
        <div class="text-sm space-y-2">
            <div>Maximum Need: [${maxValues.join(', ')}]</div>
            <div>Current Allocation: [${allocationValues.join(', ')}]</div>
            <div>Remaining Need: [${need[currentProcess].join(', ')}]</div>
        </div>
    `;

    // Update displays
    updateProcessMatrix();
    updateResourcesDisplay();

    // Enable next process button if need is valid
    needConfirmed = true;
    updateNavigationButtons();
    
    showSuccess("Process values confirmed!");
    
    return true;
}

function updateProcessMatrix(highlightRow = null) {
    const tbody = document.getElementById('processTableBody');
    tbody.innerHTML = '';

    for (let i = 0; i < processes; i++) {
        const row = document.createElement('tr');
        if (highlightRow === i) {
            row.className = 'bg-yellow-100 transition-colors duration-1000';
            // Remove highlight after 2 seconds
            setTimeout(() => {
                if (row.parentNode) {
                    row.className = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                }
            }, 2000);
        } else {
            row.className = i === currentProcess ? 'bg-indigo-50' : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50');
        }

        // Process ID
        const processCell = document.createElement('td');
        processCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
        processCell.textContent = `P${i}`;
        row.appendChild(processCell);

        // Allocation
        const allocationCell = document.createElement('td');
        allocationCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        allocationCell.textContent = allocation[i] ? `[${allocation[i].join(', ')}]` : '...';
        row.appendChild(allocationCell);

        // Maximum
        const maxCell = document.createElement('td');
        maxCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        maxCell.textContent = maximum[i] ? `[${maximum[i].join(', ')}]` : '...';
        row.appendChild(maxCell);

        // Need
        const needCell = document.createElement('td');
        needCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono';
        needCell.textContent = need[i] ? `[${need[i].join(', ')}]` : '...';
        row.appendChild(needCell);

        tbody.appendChild(row);
    }
}

function updateResourcesDisplay(highlight = false) {
    const totalDiv = document.getElementById('totalResourcesValue');
    const availableDiv = document.getElementById('availableResourcesValue');
    const allocatedDiv = document.getElementById('totalAllocatedValue');
    
    totalDiv.textContent = totalResources.length > 0 ? `[${totalResources.join(', ')}]` : '...';
    
    availableDiv.textContent = available.length > 0 ? `[${available.join(', ')}]` : '...';
    if (highlight) {
        availableDiv.classList.add('highlight-change');
        setTimeout(() => availableDiv.classList.remove('highlight-change'), 2000);
    }
    
    allocatedDiv.textContent = totalAllocated.length > 0 ? `[${totalAllocated.join(', ')}]` : '...';
    if (highlight) {
        allocatedDiv.classList.add('highlight-change');
        setTimeout(() => allocatedDiv.classList.remove('highlight-change'), 2000);
    }
}

// Animation functions
function animateSafetyStep(step, delay) {
    return new Promise(resolve => {
        setTimeout(() => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'p-4 bg-gray-50 rounded-xl opacity-0 transform translate-y-4 step-animation';
            stepDiv.innerHTML = step;
            
            document.getElementById('safetySteps').appendChild(stepDiv);
            
            // Animate the step
            setTimeout(() => {
                stepDiv.classList.add('show');
                resolve();
            }, 100);
        }, delay);
    });
}

function runSafetyAlgorithm() {
    const safetyCheck = document.getElementById('safetyCheck');
    safetyCheck.classList.remove('hidden');
    
    // Scroll to safety check section
    safetyCheck.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    const stepsDiv = document.getElementById('safetySteps');
    stepsDiv.innerHTML = '';
    safetySequence = [];
    allSafeSequences = []; // Reset all safe sequences
    
    let work = [...available];
    let finish = Array(processes).fill(false);

    // Animate initial state
    animateSafetyStep(`
        <div class="font-medium text-gray-900 mb-2">Initial State</div>
        <div class="space-y-2 text-sm">
            <div class="text-indigo-600 font-mono">Work (Available Resources): [${work.join(', ')}]</div>
            <div class="text-green-600 font-mono">Finish (Process Completed): [${finish.map(f => f ? 'Yes' : 'No').join(', ')}]</div>
        </div>
    `, 0);

    // Execute the safety algorithm
    setTimeout(() => {
        executeSafetyAlgorithm(work, finish);
    }, animationSpeed);
}

async function executeSafetyAlgorithm(work, finish) {
    let found;
    let step = 1;
    let attemptedProcesses = []; // Track processes we've tried but couldn't execute
    
    do {
        found = false;
        for (let i = 0; i < processes; i++) {
            if (!finish[i]) {
                if (canFinish(i, work)) {
                    // We found a process that can finish
                    finish[i] = true;
                    
                    // Create copy of work array before updating
                    let workBefore = [...work];
                    
                    // Release its resources
                    for (let j = 0; j < resources; j++) {
                        work[j] += allocation[i][j];
                    }
                    safetySequence.push(i);
                    found = true;
                    
                    // Animate this step with more details
                    await animateSafetyStep(`
                        <div class="font-medium text-gray-900 mb-2">Step ${step}: Process P${i} can finish</div>
                        <div class="space-y-2 text-sm">
                            <div class="mb-1">P${i} needs [${need[i].join(', ')}] and available resources are [${workBefore.join(', ')}]</div>
                            <div class="mb-1 text-green-600">✓ All needed resources can be granted</div>
                            <div class="mb-1">P${i} will execute and then release all its resources [${allocation[i].join(', ')}]</div>
                            <div class="text-indigo-600 font-mono">New Work (Available): [${work.join(', ')}]</div>
                            <div class="text-green-600 font-mono">Finish: [${finish.map((f, idx) => (idx === i ? '<span class="font-bold bg-green-100 px-1">Yes</span>' : (f ? 'Yes' : 'No'))).join(', ')}]</div>
                        </div>
                    `, step * animationSpeed);
                    
                    // Reset the attempts list since we found a process that could execute
                    attemptedProcesses = [];
                    
                    step++;
                    break;
                } else {
                    // Track processes we tried but couldn't execute
                    if (!attemptedProcesses.includes(i)) {
                        attemptedProcesses.push(i);
                        
                        // Show why this process can't execute yet
                        await animateSafetyStep(`
                            <div class="font-medium text-gray-900 mb-2">Checking Process P${i}</div>
                            <div class="space-y-2 text-sm">
                                <div class="mb-1">P${i} needs [${need[i].join(', ')}] but available resources are only [${work.join(', ')}]</div>
                                <div class="mb-1 text-orange-600">⚠ Cannot allocate - insufficient resources</div>
                                <div class="text-gray-600">Will try other processes first</div>
                            </div>
                        `, step * animationSpeed);
                        
                        step++;
                    }
                }
            }
        }
    } while (found);

    // Show final result
    const isSafe = finish.every(f => f);
    const blockedProcesses = finish.map((f, i) => !f ? i : -1).filter(p => p !== -1);
    
    // Find all possible safe sequences if the state is safe
    let allPathsHtml = '';
    if (isSafe) {
        // Find all possible safe sequences
        const numSafeSequences = findAllSafeSequences();
        
        if (numSafeSequences > 1) {
            allPathsHtml = `
                <div class="mt-4 p-3 bg-indigo-100 rounded-lg">
                    <p class="font-bold text-indigo-800">All Possible Safe Sequences (${numSafeSequences}):</p>
                    <div class="mt-2 space-y-2">
                        ${allSafeSequences.map((seq, index) => `
                            <div class="flex flex-wrap items-center p-2 ${safetySequence.join(',') === seq.join(',') ? 'bg-green-100 border border-green-300' : 'bg-white border border-indigo-200'} rounded-lg">
                                <span class="text-xs font-medium text-gray-500 mr-2">Path ${index + 1}:</span>
                                ${seq.map((p, i) => `
                                    <span class="inline-flex items-center mx-1 my-1">
                                        <span class="bg-indigo-200 text-indigo-800 px-2 py-1 rounded">P${p}</span>
                                        ${i < seq.length - 1 ? 
                                        '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>' : ''}
                                    </span>
                                `).join('')}
                                ${safetySequence.join(',') === seq.join(',') ? '<span class="ml-2 text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">Current Path</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // Create detailed deadlock explanation if needed
    let deadlockExplanation = '';
    if (!isSafe) {
        deadlockExplanation = `
            <div class="mt-4 p-3 bg-red-100 rounded-lg">
                <p class="font-bold">Deadlock Analysis:</p>
                <ul class="list-disc pl-5 mt-2 space-y-2">
                ${blockedProcesses.map(p => `
                    <li>Process P${p} needs [${need[p].join(', ')}] but only [${work.join(', ')}] are available</li>
                `).join('')}
                <li>These processes are waiting for each other to release resources</li>
                <li>No process can make progress, resulting in a deadlock</li>
                </ul>
            </div>
        `;
    }
    
    const resultDiv = document.createElement('div');
    resultDiv.className = `p-4 rounded-xl opacity-0 transform translate-y-4 step-animation ${isSafe ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`;
    resultDiv.innerHTML = isSafe 
        ? `<div class="flex items-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="font-bold text-lg">System is in a SAFE state!</p>
           </div>
           <div class="mt-3 p-3 bg-green-100 rounded-lg">
              <p class="font-bold">Safe Sequence:</p>
              <p class="mt-2 text-lg font-mono flex flex-wrap">${safetySequence.map((i, idx) => 
                `<span class="inline-flex items-center mx-1 my-1">
                   <span class="bg-green-200 text-green-800 px-2 py-1 rounded">P${i}</span>
                   ${idx < safetySequence.length - 1 ? 
                   '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>' : ''}
                 </span>`
              ).join('')}</p>
              <p class="mt-3">This sequence guarantees that all processes can complete without deadlock.</p>
           </div>
           ${allPathsHtml}`
        : `<div class="flex items-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="font-bold text-lg">System is in an UNSAFE state!</p>
           </div>
           <p class="mt-2">Deadlock may occur. These processes cannot complete:</p>
           <p class="font-mono mt-1 text-lg">${blockedProcesses.map(p => 
               `<span class="inline-block m-1 bg-red-200 text-red-800 px-2 py-1 rounded">P${p}</span>`
           ).join(' ')}</p>
           ${deadlockExplanation}`;
    
    document.getElementById('safetySteps').appendChild(resultDiv);
    setTimeout(() => {
        resultDiv.classList.add('show');
        // Scroll to see results
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Show toast notification with results summary
        if (isSafe) {
            showToast(`System is in a SAFE state! ${allSafeSequences.length > 1 ? allSafeSequences.length + ' safe paths found.' : ''}`, 'success');
        } else {
            showToast(`System is in an UNSAFE state! Deadlock may occur.`, 'error');
        }
    }, 100);
}

function canFinish(process, work) {
    // Check if process can finish with available work resources
    for (let r = 0; r < resources; r++) {
        if (need[process][r] > work[r]) {
            return false;
        }
    }
    return true;
}

// Modified to find all possible safe sequences
function findAllSafeSequences() {
    // Reset the global array of all safe sequences
    allSafeSequences = [];
    
    // Create copies of the process state variables
    let tempAvailable = [...available];
    let tempFinish = Array(processes).fill(false);
    
    // Start the recursive function to find all safe sequences
    findSafeSequences(tempAvailable, tempFinish, []);
    
    // Return the number of safe sequences found
    return allSafeSequences.length;
}

// Recursive function to find all possible safe sequences
function findSafeSequences(work, finish, currentSequence) {
    // Base case: If all processes are finished, we've found a safe sequence
    if (finish.every(f => f)) {
        // Store this sequence if we haven't found it already
        if (!allSafeSequences.some(seq => arraysEqual(seq, currentSequence))) {
            allSafeSequences.push([...currentSequence]);
        }
        return;
    }
    
    // Try to find processes that can finish with current work resources
    let anyProcessCanFinish = false;
    
    for (let i = 0; i < processes; i++) {
        // Skip if process is already finished
        if (finish[i]) continue;
        
        // Check if process can finish with current work resources
        if (canFinish(i, work)) {
            anyProcessCanFinish = true;
            
            // Create copies of work and finish arrays
            let newWork = [...work];
            let newFinish = [...finish];
            
            // Mark process as finished and update work
            newFinish[i] = true;
            for (let r = 0; r < resources; r++) {
                newWork[r] += allocation[i][r];
            }
            
            // Continue with this process in the sequence
            findSafeSequences(newWork, newFinish, [...currentSequence, i]);
        }
    }
    
    // If no process can finish at this point, we've reached a deadlock
    if (!anyProcessCanFinish && !finish.every(f => f)) {
        // This branch doesn't lead to a safe sequence
        return;
    }
}

// Helper function to compare arrays for equality
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Tutorial Mode functions
function startTutorial() {
    tutorialMode = true;
    currentTutorialStep = 0;
    document.getElementById('tutorialMode').classList.remove('hidden');
    showTutorialStep();
}

function showTutorialStep() {
    const tutorialSteps = [
        {
            title: "Welcome to Banker's Algorithm",
            content: "This tutorial will guide you through understanding and using the Banker's Algorithm for deadlock avoidance.",
            highlight: 'initialSetup'
        },
        {
            title: "Step 1: System Setup",
            content: "Start by entering the number of processes and resources in your system.",
            highlight: 'initialSetup'
        },
        {
            title: "Step 2: Resource Configuration",
            content: "Specify the total resources available and their initial availability.",
            highlight: 'resourceSetup'
        },
        {
            title: "Step 3: Process Details",
            content: "For each process, enter its current resource allocation and maximum resource needs.",
            highlight: 'processInput'
        },
        {
            title: "Step 4: Safety Algorithm",
            content: "Watch how the algorithm determines if the system state is safe.",
            highlight: 'safetyCheck'
        },
        {
            title: "Step 5: Resource Management",
            content: "Learn how to request and release resources safely.",
            highlight: 'requestSimulation'
        }
    ];
    
    if (currentTutorialStep >= tutorialSteps.length) {
        endTutorial();
        return;
    }
    
    const step = tutorialSteps[currentTutorialStep];
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialContent').textContent = step.content;
    
    // Remove previous highlights
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
    
    // Add new highlight
    const highlightEl = document.getElementById(step.highlight);
    if (highlightEl) {
        highlightEl.classList.add('highlight');
    }
}

function nextTutorialStep() {
    currentTutorialStep++;
    showTutorialStep();
}

function endTutorial() {
    tutorialMode = false;
    document.getElementById('tutorialMode').classList.add('hidden');
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
}

// Statistics functions
function updateStatistics(action, granted = true) {
    if (action === 'request') {
        if (granted) {
            statistics.requestsGranted++;
        } else {
            statistics.requestsDenied++;
            statistics.deadlocksAvoided++;
        }
    } else if (action === 'release') {
        statistics.resourcesReleased++;
    }
    
    updateStatisticsDisplay();
}

function updateStatisticsDisplay() {
    const statsDiv = document.getElementById('statisticsPanel');
    statsDiv.classList.remove('hidden');
    
    document.getElementById('requestsGranted').textContent = statistics.requestsGranted;
    document.getElementById('requestsDenied').textContent = statistics.requestsDenied;
    document.getElementById('deadlocksAvoided').textContent = statistics.deadlocksAvoided;
    document.getElementById('resourcesReleased').textContent = statistics.resourcesReleased;
}

// Utility functions
function validateInput(input, label) {
    if (!input || input.trim() === '') {
        showError(`Please enter ${label} values`);
        return null;
    }
    
    try {
        // Remove spaces and split by commas
        const values = input.replace(/\s+/g, '').split(',');
        // Convert to numbers
        const numberValues = values.map(val => {
            const num = parseInt(val.trim());
            // Check if it's a valid number
            if (isNaN(num) || num < 0) {
                throw new Error(`${label} values must be non-negative numbers`);
            }
            return num;
        });
        return numberValues;
    } catch (e) {
        showError(e.message);
        return null;
    }
}

function resetSimulator() {
    // Reset all data structures
    processes = 0;
    resources = 0;
    allocation = [];
    maximum = [];
    need = [];
    available = [];
    totalResources = [];
    totalAllocated = [];
    safetySequence = [];
    processState = [];
    needConfirmed = false;
    currentProcess = 0;
    
    // Reset statistics
    statistics = {
        requestsGranted: 0,
        requestsDenied: 0,
        resourcesReleased: 0,
        deadlocksAvoided: 0
    };
    
    // Reset form elements to starting values
    document.getElementById('processes').value = '3';
    document.getElementById('resourceTypes').value = '3';
    document.getElementById('totalResources').value = '';
    document.getElementById('available').value = '';
    
    // Reset UI elements
    document.getElementById('initialSetup').classList.remove('hidden');
    document.getElementById('resourceSetup').classList.add('hidden');
    document.getElementById('processInput').classList.add('hidden');
    document.getElementById('visualization').classList.add('hidden');
    document.getElementById('requestSimulation').classList.add('hidden');
    document.getElementById('resourceRelease').classList.add('hidden');
    document.getElementById('statisticsPanel').classList.add('hidden');
    
    // Reset message displays
    hideError();
    
    // Reset process table
    document.getElementById('processTableBody').innerHTML = '';
    document.getElementById('safetySteps').innerHTML = '';
    
    // Clear any toast notifications
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
        toastContainer.innerHTML = '';
    }
    
    // Reset the state to the very beginning
    showStep('initialSetup');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

function hideError() {
    // This function is now effectively a no-op since toasts auto-dismiss
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}

// Toast notification system
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    
    // Configure based on type
    let bgColor, iconSvg;
    
    if (type === 'error') {
        bgColor = 'bg-red-100 border-red-400 text-red-700';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
    } else if (type === 'success') {
        bgColor = 'bg-green-100 border-green-400 text-green-700';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
    } else {
        bgColor = 'bg-blue-100 border-blue-400 text-blue-700';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
    }
    
    // Set toast content and classes
    toast.className = `flex items-center p-4 max-w-sm w-full ${bgColor} border rounded-lg shadow-lg transform transition-transform duration-300 ease-in-out translate-x-full`;
    
    toast.innerHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 mr-3">
            ${iconSvg}
        </div>
        <div class="ml-2 text-sm font-medium">${message}</div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-gray-200 focus:ring-2 focus:ring-gray-300" onclick="this.parentElement.remove()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    
    // Add to container
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 5000);
}

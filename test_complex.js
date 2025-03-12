/**
 * Base interface for data models
 */
class BaseModel {
    /**
     * Initialize the base model
     * @param {Object} data Initial data
     */
    constructor(data) {
        this.data = data;
        this.timestamp = Date.now();
    }

    /**
     * Validate the model data
     * @returns {boolean} Validation result
     */
    validate() {
        return true;
    }
}

/**
 * User data management class
 */
class UserModel extends BaseModel {
    /**
     * Create a new user model
     * @param {Object} userData User information
     */
    constructor(userData) {
        super(userData);
        this.username = userData.username;
        this.email = userData.email;
    }

    /**
     * Validate user data
     * @returns {boolean} Validation result
     */
    validate() {
        return this.username && this.email;
    }

    /**
     * Update user profile
     * @param {Object} newData Updated user data
     * @returns {Promise<Object>} Updated user object
     */
    async updateProfile(newData) {
        await this.validateNewData(newData);
        return Object.assign(this, newData);
    }

    /**
     * Validate new data before update
     * @param {Object} newData Data to validate
     */
    async validateNewData(newData) {
        if (!newData) throw new Error('Invalid data');
    }
}

/**
 * Data service for handling API requests
 */
class DataService {
    /**
     * Initialize the service
     * @param {string} apiUrl API endpoint
     */
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.cache = new Map();
    }

    /**
     * Fetch data from API
     * @param {string} endpoint API endpoint
     * @returns {Promise<Object>} Response data
     */
    async fetchData(endpoint) {
        if (this.cache.has(endpoint)) {
            return this.cache.get(endpoint);
        }
        const response = await fetch(`${this.apiUrl}/${endpoint}`);
        const data = await response.json();
        this.cache.set(endpoint, data);
        return data;
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
}

/**
 * User service for managing user operations
 */
class UserService extends DataService {
    /**
     * Create user service instance
     * @param {string} apiUrl API endpoint
     * @param {Object} options Service options
     */
    constructor(apiUrl, options = {}) {
        super(apiUrl);
        this.options = options;
    }

    /**
     * Get user by ID
     * @param {string} userId User identifier
     * @returns {Promise<UserModel>} User model instance
     */
    async getUserById(userId) {
        const userData = await this.fetchData(`users/${userId}`);
        return new UserModel(userData);
    }

    /**
     * Update user data
     * @param {string} userId User identifier
     * @param {Object} updateData New user data
     * @returns {Promise<UserModel>} Updated user model
     */
    async updateUser(userId, updateData) {
        const user = await this.getUserById(userId);
        return user.updateProfile(updateData);
    }
}

/**
 * Authentication service
 */
class AuthService {
    /**
     * Initialize auth service
     * @param {UserService} userService User service instance
     */
    constructor(userService) {
        this.userService = userService;
        this.currentUser = null;
    }

    /**
     * Login user
     * @param {string} username Username
     * @param {string} password Password
     * @returns {Promise<Object>} Login result
     */
    async login(username, password) {
        // Simulate authentication
        const userData = await this.userService.fetchData('auth/login');
        this.currentUser = new UserModel(userData);
        return this.currentUser;
    }

    /**
     * Logout current user
     */
    logout() {
        this.currentUser = null;
    }
}

// Create service instances
const apiUrl = 'https://api.example.com';
const userService = new UserService(apiUrl, { timeout: 5000 });
const authService = new AuthService(userService);

/**
 * Initialize application
 */
async function initializeApp() {
    try {
        const user = await authService.login('admin', 'password');
        await userService.updateUser(user.id, { lastLogin: Date.now() });
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

// Export modules
export {
    BaseModel,
    UserModel,
    DataService,
    UserService,
    AuthService,
    initializeApp
}; 
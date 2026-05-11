export function teardownWalineInstance(instance, mountedContainer) {
	if (!instance) {
		return {
			destroyed: false,
			reason: "missing-instance",
		};
	}

	if (!mountedContainer?.isConnected) {
		return {
			destroyed: false,
			reason: "detached-container",
		};
	}

	try {
		instance.destroy();
	} catch (error) {
		return {
			destroyed: false,
			reason: "destroy-failed",
			error,
		};
	}

	return {
		destroyed: true,
		reason: "destroyed",
	};
}

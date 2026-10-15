import random

import pytest

from app.core.datasets import get_dataset, problem_from_dict
from app.core.problem import Problem


@pytest.fixture
def toy() -> Problem:
    """Review-1 toy example: R = (100, 120)."""
    return problem_from_dict(get_dataset("toy"))


@pytest.fixture
def small() -> Problem:
    return problem_from_dict(get_dataset("small"))


@pytest.fixture
def medium() -> Problem:
    return problem_from_dict(get_dataset("medium"))


@pytest.fixture
def rnd() -> random.Random:
    return random.Random(123)
